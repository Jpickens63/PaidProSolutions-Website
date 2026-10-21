/* Shared browser workspace. Legacy keys are read, never overwritten or removed. */
(function (root) {
  "use strict";
  const key = "paidpro-client-lite-v2";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uuid = () => crypto.randomUUID();
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const priorities = ["low","normal","high","urgent"];
  const taskNumberPattern = /^TASK-\d{3,9}$/;
  let memory, writable = true, warning = "";
  const listeners = new Set();
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime()) && localDate(date) === value;
  }
  const formatTaskNumber = sequence => `TASK-${String(sequence).padStart(3,"0")}`;
  function assignTaskNumbers(tasks) {
    const used = new Set(); let highest = 0, changed = false;
    for (const task of tasks) {
      if (taskNumberPattern.test(task.taskNumber || "") && !used.has(task.taskNumber)) {
        used.add(task.taskNumber); highest = Math.max(highest, Number(task.taskNumber.slice(5)));
      } else if (task.taskNumber !== undefined) {
        delete task.taskNumber; changed = true;
      }
    }
    for (const task of tasks) {
      if (task.taskNumber) continue;
      do { highest += 1; task.taskNumber = formatTaskNumber(highest); } while (used.has(task.taskNumber));
      used.add(task.taskNumber); changed = true;
    }
    return changed;
  }
  function nextTaskNumber(state) {
    const highest = state.tasks.reduce((max, task) => taskNumberPattern.test(task.taskNumber || "") ? Math.max(max, Number(task.taskNumber.slice(5))) : max, 0);
    return formatTaskNumber(highest + 1);
  }
  function validTask(t) {
    return t && typeof t.id === "string" && t.id.length > 0 && t.id.length <= 80 && taskNumberPattern.test(t.taskNumber) && typeof t.name === "string" && t.name.trim() && t.name.length <= 150 && typeof t.description === "string" && t.description.length <= 2000 && Number.isFinite(t.estimate) && t.estimate > 0 && t.estimate <= 100000 && validDate(t.start) && validDate(t.due) && typeof t.project === "string" && typeof t.projectName === "string" && typeof t.milestone === "string" && priorities.includes(t.priority) && Number.isFinite(t.createdAt) && typeof t.complete === "boolean" && typeof t.archived === "boolean" && (t.scheduleMode === undefined || t.scheduleMode === "auto" || t.scheduleMode === "manual") && (t.dependsOn === undefined || t.dependsOn === null || typeof t.dependsOn === "string" && t.dependsOn.length <= 80);
  }
  function validEntry(e, active = false) {
    return e && typeof e.id === "string" && typeof e.task === "string" && typeof e.category === "string" && Number.isFinite(e.start) && e.start >= 0 && (active || Number.isFinite(e.end) && e.end >= e.start);
  }
  function validState(s) {
    if (!(s && s.version === 2 && Array.isArray(s.tasks) && s.tasks.every(validTask) && new Set(s.tasks.map(t=>t.id)).size === s.tasks.length && new Set(s.tasks.map(t=>t.taskNumber)).size === s.tasks.length && Array.isArray(s.entries) && s.entries.every(e=>validEntry(e)) && Array.isArray(s.tickets) && s.tickets.every(t=>t && typeof t.task === "string" && validDate(t.day) && Number.isFinite(t.hours) && t.hours > 0) && (s.active === null || validEntry(s.active,true)))) return false;
    const byId=new Map(s.tasks.map(t=>[t.id,t]));
    for(const task of s.tasks){
      if(task.dependsOn && (!byId.has(task.dependsOn)||task.dependsOn===task.id))return false;
      const seen=new Set([task.id]);let current=task;
      while(current.dependsOn){if(seen.has(current.dependsOn))return false;seen.add(current.dependsOn);current=byId.get(current.dependsOn);if(!current)break;}
    }
    return true;
  }
  function seed() {
    const today = localDate(), plus = n => { const d = new Date(); d.setDate(d.getDate()+n); return localDate(d); };
    const requirementsId = uuid(), planId = uuid(), reviewId = uuid(), createdAt = Date.now();
    return {version:2,revision:0,tasks:[
      {id:requirementsId,taskNumber:"TASK-001",project:"PPS-CLIENT-01",projectName:"Client Portal Rollout",milestone:"Requirements Approved",name:"Confirm project requirements",description:"Review the client workflow, deliverables, and acceptance criteria.",estimate:2,start:today,due:plus(1),priority:"high",scheduleMode:"auto",dependsOn:null,createdAt,complete:false,archived:false},
      {id:planId,taskNumber:"TASK-002",project:"PPS-CLIENT-01",projectName:"Client Portal Rollout",milestone:"Implementation Ready",name:"Prepare implementation plan",description:"Break the approved scope into scheduled work and confirm resource needs.",estimate:4,start:today,due:plus(4),priority:"normal",scheduleMode:"auto",dependsOn:requirementsId,createdAt:createdAt+1,complete:false,archived:false},
      {id:reviewId,taskNumber:"TASK-003",project:"PPS-CLIENT-01",projectName:"Client Portal Rollout",milestone:"Client Approval",name:"Present project plan",description:"Walk through dates, dependencies, and approval points with the client.",estimate:1.5,start:today,due:plus(5),priority:"normal",scheduleMode:"auto",dependsOn:planId,createdAt:createdAt+2,complete:false,archived:false}
    ],entries:[],tickets:[],active:null};
  }
  function isPlaceholderWorkspace(state) {
    return state && state.version === 2 && state.active === null && Array.isArray(state.entries) && state.entries.length === 0 && Array.isArray(state.tickets) && state.tickets.length === 0 && Array.isArray(state.tasks) && state.tasks.length > 0 && state.tasks.length <= 20 && state.tasks.every(task => /^TEST\d+$/i.test(task.project || "") && /^(?:TASK|TSK)\s*\d+$/i.test(task.name || "") && /^TASK\s+(?:DESC|DECS|DESCRIPTION)S?\.?$/i.test(task.description || ""));
  }
  function migrate() {
    const liteRaw = localStorage.getItem("paidpro-lite-example-v1"), managerRaw = localStorage.getItem("paidpro-task-manager-v1");
    if (!liteRaw && !managerRaw) return seed();
    const s = {version:2,revision:0,tasks:[],entries:[],tickets:[],active:null};
    if (liteRaw) {
      const old = JSON.parse(liteRaw);
      if (!Array.isArray(old.tasks) || !Array.isArray(old.entries) || !Array.isArray(old.tickets)) throw Error("Unreadable old Client Lite workspace");
      s.tasks = old.tasks.map((t,i)=>({...t,priority:t.priority||"normal",scheduleMode:"auto",dependsOn:null,createdAt:t.createdAt||Date.now()+i,complete:Boolean(t.complete),archived:false}));
      s.entries=old.entries;s.tickets=old.tickets;s.active=old.active||null;
    }
    if (managerRaw) {
      const old = JSON.parse(managerRaw);
      if (old.version !== 1 || !Array.isArray(old.tasks)) throw Error("Unreadable old Task-Manager workspace");
      for (const t of old.tasks) {
        s.tasks.push({id:s.tasks.some(a=>a.id===t.id)?uuid():t.id,project:"PERSONAL",projectName:"My tasks",milestone:"General",name:t.name,description:t.description,estimate:t.hours,start:t.due<localDate()?t.due:localDate(),due:t.due,priority:t.priority,scheduleMode:"auto",dependsOn:null,createdAt:t.createdAt,complete:false,archived:false});
      }
    }
    assignTaskNumbers(s.tasks);
    if (!validState(s)) throw Error("Old workspace contains invalid records");
    return s;
  }
  function emit() { listeners.forEach(fn=>fn()); }
  try {
    const raw = localStorage.getItem(key);
    memory = raw ? JSON.parse(raw) : migrate();
    const replacedPlaceholders = Boolean(raw && isPlaceholderWorkspace(memory));
    if (replacedPlaceholders) memory = seed();
    const upgraded = assignTaskNumbers(memory.tasks);
    if (!validState(memory)) throw Error("Unreadable shared workspace");
    if (!raw || replacedPlaceholders || upgraded) localStorage.setItem(key,JSON.stringify(memory));
  } catch {
    writable=false;if(!validState(memory))memory={version:2,revision:0,tasks:[],entries:[],tickets:[],active:null};
    warning="Saved data could not be loaded or merged, or browser storage is blocked. Original data has not been changed. This workspace is temporary; export any new work before closing.";
  }
  function get() {
    if (writable) {
      try {
        const raw=localStorage.getItem(key), latest=raw?JSON.parse(raw):null;
        const upgraded=latest&&Array.isArray(latest.tasks)?assignTaskNumbers(latest.tasks):false;
        if (!validState(latest)) throw Error();
        memory=latest;if(upgraded)localStorage.setItem(key,JSON.stringify(memory));
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
    const byId=new Map(state.tasks.map(t=>[t.id,t]));
    return state.tasks.filter(t=>!t.complete&&!t.archived).map(t=>{const mode=t.scheduleMode==="manual"?"manual":"auto",dependency=t.dependsOn?byId.get(t.dependsOn):null;return {id:t.id,taskNumber:t.taskNumber,name:t.name,description:t.description,hours:t.estimate,priority:t.priority,due:t.due,scheduleMode:mode,availableFrom:mode==="manual"?t.start:localDate(),dependsOn:t.dependsOn||null,dependencyComplete:Boolean(dependency?.complete),dependencyName:dependency?.name||"",dependencyNumber:dependency?.taskNumber||"",active:state.active?.category==='TASK'&&state.active.task===t.id,createdAt:t.createdAt,chargedHours:chargedHours(t,state)};});
  }
  function saveManagerTasks(tasks, expectedRevision) {
    return update(s=>{
      if(s.revision!==expectedRevision) throw Error("Workspace changed in another window. Reload the task details and retry; no saved data was overwritten.");
      const ids=new Set(tasks.map(t=>t.id));
      for (const t of s.tasks) if(!t.complete&&!t.archived&&!ids.has(t.id)) {
        if(s.active?.task===t.id&&s.active.category==="TASK") throw Error("Stop the Time Card timer before removing its task.");
        const dependent=s.tasks.find(item=>!item.complete&&!item.archived&&item.dependsOn===t.id&&ids.has(item.id));
        if(dependent)throw Error(`Remove the dependency from "${dependent.name}" before removing "${t.name}".`);
        t.archived=true;
      }
      for(const t of tasks) {
        const current=s.tasks.find(a=>a.id===t.id);
        const fields={name:t.name,description:t.description,estimate:t.hours,priority:t.priority,due:t.due,dependsOn:t.dependsOn||null};
        if(current) Object.assign(current,fields);
        else s.tasks.push({id:t.id,taskNumber:nextTaskNumber(s),project:"PERSONAL",projectName:"My tasks",milestone:"General",...fields,start:t.due<localDate()?t.due:localDate(),scheduleMode:"auto",createdAt:t.createdAt,complete:false,archived:false});
      }
      return s;
    });
  }
  window.addEventListener("storage",e=>{if(e.key===key||e.key===null){get();emit();}});
  root.ClientLiteStore={key,get,update,seed,managerTasks,saveManagerTasks,chargedHours,nextTaskNumber,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},warning:()=>warning,writable:()=>writable};
})(globalThis);
