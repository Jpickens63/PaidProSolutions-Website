/* Shared browser workspace. Legacy keys are read, never overwritten or removed. */
(function (root) {
  "use strict";
  const key = "paidpro-client-lite-v2";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uuid = () => crypto.randomUUID();
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const priorities = ["low","normal","high","urgent"];
  let memory, writable = true, warning = "";
  const listeners = new Set();
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime()) && localDate(date) === value;
  }
  function validTask(t) {
    return t && typeof t.id === "string" && t.id.length > 0 && t.id.length <= 80 && typeof t.name === "string" && t.name.trim() && t.name.length <= 150 && typeof t.description === "string" && t.description.length <= 2000 && Number.isFinite(t.estimate) && t.estimate > 0 && t.estimate <= 100000 && validDate(t.start) && validDate(t.due) && typeof t.project === "string" && typeof t.projectName === "string" && typeof t.milestone === "string" && priorities.includes(t.priority) && Number.isFinite(t.createdAt) && typeof t.complete === "boolean" && typeof t.archived === "boolean";
  }
  function validEntry(e, active = false) {
    return e && typeof e.id === "string" && typeof e.task === "string" && typeof e.category === "string" && Number.isFinite(e.start) && e.start >= 0 && (active || Number.isFinite(e.end) && e.end >= e.start);
  }
  function validState(s) {
    return s && s.version === 2 && Array.isArray(s.tasks) && s.tasks.every(validTask) && new Set(s.tasks.map(t=>t.id)).size === s.tasks.length && Array.isArray(s.entries) && s.entries.every(e=>validEntry(e)) && Array.isArray(s.tickets) && s.tickets.every(t=>t && typeof t.task === "string" && validDate(t.day) && Number.isFinite(t.hours) && t.hours > 0) && (s.active === null || validEntry(s.active,true));
  }
  function seed() {
    const today = localDate(), plus = n => { const d = new Date(); d.setDate(d.getDate()+n); return localDate(d); };
    return {version:2,revision:0,tasks:[
      {id:uuid(),project:"DEMO001",projectName:"Workshop improvement",milestone:"Design ready",name:"Concept layout",description:"Review the layout and record design time",estimate:3,start:today,due:plus(2),priority:"high",createdAt:Date.now(),complete:false,archived:false},
      {id:uuid(),project:"DEMO001",projectName:"Workshop improvement",milestone:"Design ready",name:"Detail drawing",description:"Produce the detail drawing",estimate:4,start:plus(1),due:plus(4),priority:"normal",createdAt:Date.now()+1,complete:false,archived:false},
      {id:uuid(),project:"DEMO002",projectName:"Calibration tooling",milestone:"Prototype ready",name:"Prototype review",description:"Inspect the fit and document observations",estimate:1,start:today,due:plus(1),priority:"normal",createdAt:Date.now()+2,complete:false,archived:false}
    ],entries:[],tickets:[],active:null};
  }
  function migrate() {
    const liteRaw = localStorage.getItem("paidpro-lite-example-v1"), managerRaw = localStorage.getItem("paidpro-task-manager-v1");
    if (!liteRaw && !managerRaw) return seed();
    const s = {version:2,revision:0,tasks:[],entries:[],tickets:[],active:null};
    if (liteRaw) {
      const old = JSON.parse(liteRaw);
      if (!Array.isArray(old.tasks) || !Array.isArray(old.entries) || !Array.isArray(old.tickets)) throw Error("Unreadable old Client Lite workspace");
      s.tasks = old.tasks.map((t,i)=>({...t,priority:t.priority||"normal",createdAt:t.createdAt||Date.now()+i,complete:Boolean(t.complete),archived:false}));
      s.entries=old.entries;s.tickets=old.tickets;s.active=old.active||null;
    }
    if (managerRaw) {
      const old = JSON.parse(managerRaw);
      if (old.version !== 1 || !Array.isArray(old.tasks)) throw Error("Unreadable old Task-Manager workspace");
      for (const t of old.tasks) {
        s.tasks.push({id:s.tasks.some(a=>a.id===t.id)?uuid():t.id,project:"PERSONAL",projectName:"My tasks",milestone:"General",name:t.name,description:t.description,estimate:t.hours,start:t.due<localDate()?t.due:localDate(),due:t.due,priority:t.priority,createdAt:t.createdAt,complete:false,archived:false});
      }
    }
    if (!validState(s)) throw Error("Old workspace contains invalid records");
    return s;
  }
  function emit() { listeners.forEach(fn=>fn()); }
  try {
    const raw = localStorage.getItem(key);
    memory = raw ? JSON.parse(raw) : migrate();
    if (!validState(memory)) throw Error("Unreadable shared workspace");
    if (!raw) localStorage.setItem(key,JSON.stringify(memory));
  } catch {
    writable=false;if(!validState(memory))memory={version:2,revision:0,tasks:[],entries:[],tickets:[],active:null};
    warning="Saved data could not be loaded or merged, or browser storage is blocked. Original data has not been changed. This workspace is temporary; export any new work before closing.";
  }
  function get() {
    if (writable) {
      try {
        const raw=localStorage.getItem(key), latest=raw?JSON.parse(raw):null;
        if (!validState(latest)) throw Error();
        memory=latest;
      } catch { writable=false;warning="Shared browser data became unavailable. Original saved data has not been overwritten; changes are now session-only."; }
    }
    return clone(memory);
  }
  function update(change) {
    const next = change(get());
    if (!validState(next)) throw Error("Invalid shared workspace update");
    next.revision=(Number.isInteger(memory.revision)?memory.revision:0)+1;memory=clone(next);
    if (writable) {
      try { localStorage.setItem(key,JSON.stringify(memory)); }
      catch { writable=false;warning="Browser storage could not save the workspace. Changes are kept only for this session; export them before closing."; }
    }
    emit();return writable;
  }
  function chargedHours(task, state=get()) {
    const closed=state.entries.filter(e=>e.category==="TASK"&&e.task===task.id).reduce((sum,e)=>sum+(e.end-e.start)/3600000,0);
    return closed+(state.active?.category==="TASK"&&state.active.task===task.id?Math.max(0,Date.now()-state.active.start)/3600000:0);
  }
  function managerTasks(state=get()) {
    return state.tasks.filter(t=>!t.complete&&!t.archived).map(t=>({id:t.id,name:t.name,description:t.description,hours:t.estimate,priority:t.priority,due:t.due,availableFrom:t.start,active:state.active?.category==='TASK'&&state.active.task===t.id,createdAt:t.createdAt,chargedHours:chargedHours(t,state)}));
  }
  function saveManagerTasks(tasks, expectedRevision) {
    return update(s=>{
      if(s.revision!==expectedRevision) throw Error("Workspace changed in another window. Reload the task details and retry; no saved data was overwritten.");
      const ids=new Set(tasks.map(t=>t.id));
      for (const t of s.tasks) if(!t.complete&&!t.archived&&!ids.has(t.id)) {
        if(s.active?.task===t.id&&s.active.category==="TASK") throw Error("Stop the Time Card timer before removing its task.");
        t.archived=true;
      }
      for(const t of tasks) {
        const current=s.tasks.find(a=>a.id===t.id);
        const fields={name:t.name,description:t.description,estimate:t.hours,priority:t.priority,due:t.due};
        if(current) Object.assign(current,fields,{start:current.start>t.due?t.due:current.start});
        else s.tasks.push({id:t.id,project:"PERSONAL",projectName:"My tasks",milestone:"General",...fields,start:t.due<localDate()?t.due:localDate(),createdAt:t.createdAt,complete:false,archived:false});
      }
      return s;
    });
  }
  window.addEventListener("storage",e=>{if(e.key===key||e.key===null){get();emit();}});
  root.ClientLiteStore={key,get,update,seed,managerTasks,saveManagerTasks,chargedHours,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},warning:()=>warning,writable:()=>writable};
})(globalThis);
