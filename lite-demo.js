/* Isolated browser example. Never connects to production, uploads data, or pretends to be SQLite. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), store=ClientLiteStore, uuid=()=>crypto.randomUUID();
  const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let today=localDate(new Date());
  const plus=n=>{const d=new Date();d.setDate(d.getDate()+n);return localDate(d);};
  const seed=store.seed;
  let state, mode=false, noncharge=false, edited=null, editedRevision=0, contextTask=null;
  state=store.get();
  const save=(expected=state.revision)=>{try{store.update(current=>{if(current.revision!==expected)throw Error('Workspace changed in another window.');return state;});return true;}catch{state=store.get();toast('Workspace changed or could not be updated. Your saved records are safe; cancel and reopen task details before retrying.');render();return false;}};
  const toast=text=>{$('toast').textContent=text;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500);};
  function cell(row,text,tag='td'){const c=document.createElement(tag);c.textContent=text;row.append(c);return c;}
  function elapsed(entry){return Math.max(0,((entry.end||Date.now())-entry.start)/3600000);}
  function stop(){if(state.active){state.entries.push({...state.active,end:Date.now()});state.active=null;const saved=save();render();return saved;}return true;}
  function select(id,category='TASK'){
    const same=state.active&&state.active.task===id&&state.active.category===category;
    if(!confirm(same?'Stop recording time?':'Start charging time to this item?'))return;
    if(stop()===false)return;if(!same){state.active={id:uuid(),task:id,category,start:Date.now()};save();render();}
  }
  function render(){
    $('tasks').replaceChildren();
    const rows=noncharge?['Lunch','Break','Meeting','Holiday','Vacation','Other'].map(name=>({id:name,name,category:name.toUpperCase()})):state.tasks.filter(t=>!t.complete&&!t.archived);
    for(const task of rows){const tr=document.createElement('tr'),category=task.category||'TASK';
      [task.project||'—',task.milestone||'—',task.name,task.description||'Non-project time',task.estimate?.toFixed(2)||'—',category==='TASK'?store.chargedHours(task,state).toFixed(2):'—',task.due||'—'].forEach(text=>cell(tr,text));
      if(state.active?.task===task.id)tr.classList.add('running');tr.tabIndex=0;tr.onclick=()=>select(task.id,category);tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(task.id,category);}};
      tr.oncontextmenu=e=>context(e,category==='TASK'?task.id:null);$('tasks').append(tr);
    }renderChart();renderReports();
  }
  function context(event,id){event.preventDefault();event.stopPropagation();contextTask=id;$('context').hidden=false;$('context').style.left=Math.min(event.clientX,innerWidth-205)+'px';$('context').style.top=Math.min(event.clientY,innerHeight-190)+'px';$('context').querySelector('[data-action=edit]').disabled=!id;$('context').querySelector('[data-action=complete]').disabled=!id;}
  function edit(id=null){edited=id;editedRevision=state.revision;const t=state.tasks.find(t=>t.id===id)||{};$('editor-title').textContent=id?'Edit Task':'Add Task';
    for(const [input,prop] of [['project-code','project'],['project-name','projectName'],['milestone','milestone'],['task-name','name'],['description','description'],['estimate','estimate'],['priority','priority'],['start','start'],['due','due']])$(input).value=t[prop]??(input==='estimate'?1:input==='priority'?'normal':input==='start'||input==='due'?today:'');
    $('project-options').replaceChildren();$('milestone-options').replaceChildren();for(const name of new Set(state.tasks.map(t=>t.project))){const o=document.createElement('option');o.value=name;$('project-options').append(o);}for(const name of new Set(state.tasks.map(t=>t.milestone))){const o=document.createElement('option');o.value=name;$('milestone-options').append(o);}$('editor').showModal();
  }
  $('task-form').onsubmit=e=>{e.preventDefault();const estimate=Number($('estimate').value),start=$('start').value,due=$('due').value;if(!Number.isFinite(estimate)||estimate<=0||due<start){toast('Enter positive hours and a complete-by date on or after start.');return;}
    const task={id:edited||uuid(),project:$('project-code').value.trim().toUpperCase(),projectName:$('project-name').value.trim(),milestone:$('milestone').value.trim(),name:$('task-name').value.trim(),description:$('description').value.trim(),estimate,start,due,priority:$('priority').value,createdAt:state.tasks.find(t=>t.id===edited)?.createdAt||Date.now(),complete:false,archived:false};
    if(!task.project||!task.projectName||!task.milestone||!task.name)return toast('Enter a project, milestone and task name.');
    if(edited)state.tasks=state.tasks.map(t=>t.id===edited?{...t,...task}:t);else state.tasks.push(task);const saved=save(edited?editedRevision:state.revision);if(saved)$('editor').close();render();};
  $('cancel').onclick=()=>$('editor').close();$('add').onclick=()=>edit();$('card').oncontextmenu=e=>context(e,null);
  $('context').onclick=e=>{const action=e.target.dataset.action;$('context').hidden=true;if(action==='add')edit();if(action==='edit'&&contextTask)edit(contextTask);if(action==='stop')stop();if(action==='complete'&&contextTask){if(state.active?.task===contextTask&&stop()===false)return;state.tasks.find(t=>t.id===contextTask).complete=true;save();render();}};
  document.addEventListener('click',e=>{if(!$('context').contains(e.target))$('context').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('context').hidden=true;});
  $('mode').onclick=()=>{mode=!mode;$('mode').setAttribute('aria-checked',String(mode));$('mode-label').textContent=mode?'Project Gantt':'Time Card';$('card').hidden=mode;$('gantt').hidden=!mode;$('charge-control').hidden=mode;renderChart();if(mode)center();};
  $('charge').onclick=()=>{noncharge=!noncharge;$('charge').setAttribute('aria-checked',String(noncharge));$('charge-label').textContent=noncharge?'Non-Chargeable':'Chargeable';render();};
  function workCalendar(){
    let raw=null;try{raw=localStorage.getItem('paidpro-task-calendar-v1');}catch{}
    return PaidproGanttHours.calendar(raw);
  }
  function renderChart(){
    const calendar=workCalendar(),tasks=state.tasks.filter(t=>!t.complete&&!t.archived);
    const summary=PaidproGanttHours.calculate(tasks.map(t=>({...t,remainingHours:Math.max(0,t.estimate-store.chargedHours(t,state))})),calendar,plus(-7),plus(21));
    const hours=new Intl.NumberFormat(undefined,{maximumFractionDigits:2}),table=$('chart');table.replaceChildren();
    const head=document.createElement('thead'),h=document.createElement('tr'),label=cell(h,'Project / Milestone / Task','th');label.scope='col';
    const note=document.createElement('small');note.className='gantt-heading-note';note.textContent='Daily hours · single-user calendar';label.append(note);
    for(const day of summary.days){const c=cell(h,new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date(day.date+'T12:00:00')),'th');c.scope='col';c.dataset.date=day.date;
      if(day.date===today)c.classList.add('today');if(!day.available)c.classList.add('off-day');
      const available=document.createElement('small');available.className='gantt-available';available.textContent=`Available ${hours.format(day.available)} hr`;
      const assigned=document.createElement('small');assigned.className='gantt-assigned';assigned.textContent=`Assigned ${hours.format(day.assigned)} hr`;
      if(day.overloaded){assigned.classList.add('overloaded');c.title=`${hours.format(day.assigned-day.available)} hr over daily capacity`;}
      c.append(available,assigned);}
    head.append(h);table.append(head);const body=document.createElement('tbody');
    for(const task of tasks){const row=document.createElement('tr');cell(row,`${task.project} · ${task.milestone} / ${task.name}`);row.ondblclick=()=>edit(task.id);
      for(const day of summary.days){const c=cell(row,'');if(day.date===today)c.className='today';if(day.date>=task.start&&day.date<=task.due){const block=document.createElement('div');block.className='block';const assigned=day.allocations.find(a=>a.id===task.id)?.hours||0;block.title=`${task.name}: ${task.start} → ${task.due} · ${hours.format(assigned)} assigned hr on ${day.date}`;c.append(block);}c.onclick=()=>{table.querySelectorAll('.selected').forEach(c=>c.classList.remove('selected'));c.classList.add('selected');};}body.append(row);
    }table.append(body);
    $('work-hint').textContent=mode?`Available: ${hours.format(calendar.regular)} hr per working day; non-working days show 0. Assigned: remaining estimated hours spread across each task’s manually set working dates. Red means over capacity.${summary.unscheduled.length?' Some tasks have no working dates; edit their dates or calendar.':''}${calendar.fallback?' Saved calendar was unreadable; the default 8-hour Monday–Friday calendar is shown.':''}`:'Click a task to start, switch or stop. Right-click for task actions. Lite dates are entered manually.';
  }
  function center(){requestAnimationFrame(()=>{const day=$('chart').querySelector('th.today'),labelWidth=$('chart').querySelector('th')?.offsetWidth||280;if(day){const viewport=$('gantt').getBoundingClientRect(),rect=day.getBoundingClientRect();$('gantt').scrollLeft=Math.max(0,$('gantt').scrollLeft+rect.left+rect.width/2-viewport.left-labelWidth-($('gantt').clientWidth-labelWidth)/2);}});}
  function showModule(name) {
    if(!['work','task-manager','reports'].includes(name))name='work';
    document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b.dataset.tab===name;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});
    ['work','task-manager','reports'].forEach(id=>{$(id).hidden=id!==name;});
    if(location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);
    renderReports();if(name==='work'&&mode)center();
  }
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>showModule(button.dataset.tab));
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...document.querySelectorAll('[data-tab]')],i=buttons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length;buttons[next].focus();showModule(buttons[next].dataset.tab);}));
  window.addEventListener('hashchange',()=>showModule(location.hash.slice(1)));
  const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));$('week').value=localDate(monday);
  $('report-day').value=today;
  function renderReports(){const table=$('report-table');table.replaceChildren();const reportMode=$('report-mode').value,start=new Date($('week').value+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+7);if(!Number.isFinite(start.getTime()))return;
    const head=document.createElement('thead'),h=document.createElement('tr'),body=document.createElement('tbody');
    const daily=reportMode==='daily';$('report-day-control').hidden=!daily;$('report-week-control').hidden=daily;$('report-summary').hidden=!daily;
    $('report-title').textContent=daily?'Daily Work Report':reportMode==='ticket'?'Work Ticket':reportMode==='entries'?'Time Card — Exact Clockings':'Weekly Time Report';
    $('report-details').textContent=`Example User · Example company · ${daily?$('report-day').value:`Week starting ${$('week').value}`} · Prepared ${new Date().toLocaleString()}`;
    if(daily){
      const day=$('report-day').value,from=new Date(day+'T00:00:00'),until=new Date(from);until.setDate(until.getDate()+1);
      if(!Number.isFinite(from.getTime())){$('report-summary').textContent='Choose a valid report date.';return;}
      const tasks=state.tasks.filter(t=>!t.complete&&!t.archived),calendar=workCalendar(),summary=PaidproGanttHours.calculate(tasks.map(t=>({...t,remainingHours:Math.max(0,t.estimate-store.chargedHours(t,state))})),calendar,day,day).days[0];
      const planned=new Map(summary.allocations.map(a=>[a.id,a.hours]));
      const actual=new Map(),running=new Set();
      for(const entry of [...state.entries,...(state.active?[{...state.active,end:Date.now()}]:[])]){
        const hours=Math.max(0,Math.min(entry.end,until.getTime())-Math.max(entry.start,from.getTime()))/3600000;if(!hours)continue;
        const key=entry.category==='TASK'?entry.task:`category:${entry.category}`;actual.set(key,(actual.get(key)||0)+hours);if(entry.id===state.active?.id)running.add(key);
      }
      const ids=new Set([...tasks.filter(t=>day>=t.start&&day<=t.due).map(t=>t.id),...actual.keys()]);
      ['Project','Milestone','Task / Category','Estimated Hours','Assigned Hours','Hours Worked','Status'].forEach(t=>cell(h,t,'th'));
      let totalPlanned=0,totalWorked=0;
      for(const id of ids){const task=state.tasks.find(t=>t.id===id),assigned=planned.get(id)||0,worked=actual.get(id)||0,row=document.createElement('tr');
        totalPlanned+=assigned;totalWorked+=worked;
        [task?.project||'—',task?.milestone||'—',task?.name||(id.startsWith('category:')?id.slice(9):id),task?.estimate?.toFixed(2)||'—',assigned.toFixed(2),worked.toFixed(2),running.has(id)?'Timer running':task?.complete?'Completed':task?.archived?'Archived':task?'Open':'Non-chargeable'].forEach(v=>cell(row,v));body.append(row);
      }
      if(!ids.size){const row=document.createElement('tr'),message=cell(row,'No tasks or recorded work for this day.');message.colSpan=7;body.append(row);}
      $('report-summary').textContent=`Available: ${summary.available.toFixed(2)} hr · Assigned: ${totalPlanned.toFixed(2)} hr · Worked: ${totalWorked.toFixed(2)} hr.${running.size?' Running timer included through this preview time.':''} Assigned hours never create or change time records.`;
    }
    else if(reportMode==='ticket'){['Date','Project','Task','Planned Hours'].forEach(t=>cell(h,t,'th'));for(const t of state.tickets.filter(t=>t.day>=localDate(start)&&t.day<localDate(end))){const task=state.tasks.find(a=>a.id===t.task),r=document.createElement('tr');[t.day,task?.project||'—',task?.name||'—',t.hours.toFixed(2)].forEach(v=>cell(r,v));body.append(r);}}
    else if(reportMode==='entries'){['Project','Task / Category','Clock In','Clock Out','Hours'].forEach(t=>cell(h,t,'th'));for(const e of state.entries.filter(e=>e.start<end.getTime()&&e.end>start.getTime())){const t=state.tasks.find(t=>t.id===e.task),r=document.createElement('tr');[t?.project||'—',t?.name||e.category,new Date(e.start).toLocaleString(),new Date(e.end).toLocaleString(),elapsed(e).toFixed(2)].forEach(v=>cell(r,v));body.append(r);}}
    else{[reportMode==='projects'?'Project':'Project / Task','Mon','Tue','Wed','Thu','Fri','Sat','Sun','Total'].forEach(t=>cell(h,t,'th'));const groups=new Map();for(const e of state.entries){const t=state.tasks.find(t=>t.id===e.task),label=t?(reportMode==='projects'?t.project:`${t.project} / ${t.name}`):e.category;for(let d=0;d<7;d++){const a=new Date(start),b=new Date(start);a.setDate(a.getDate()+d);b.setDate(b.getDate()+d+1);const value=Math.max(0,Math.min(e.end,b.getTime())-Math.max(e.start,a.getTime()))/3600000;if(value){if(!groups.has(label))groups.set(label,Array(7).fill(0));groups.get(label)[d]+=value;}}}for(const [label,values] of groups){const r=document.createElement('tr');[label,...values.map(n=>n.toFixed(2)),values.reduce((a,b)=>a+b,0).toFixed(2)].forEach(v=>cell(r,v));body.append(r);}}
    head.append(h);table.append(head,body);$('plan').hidden=reportMode!=='ticket';}
  $('week').onchange=renderReports;$('report-day').onchange=renderReports;$('report-mode').onchange=renderReports;$('print').onclick=()=>{renderReports();window.print();};
  $('plan').onclick=()=>{const tasks=state.tasks.filter(t=>!t.complete&&!t.archived);if(!tasks.length)return toast('Add a task first.');const index=Number(prompt(tasks.map((t,i)=>`${i+1}. ${t.project} · ${t.name}`).join('\n')+'\nEnter task number:'));if(!Number.isInteger(index)||index<1||index>tasks.length)return;const day=prompt('Work date (YYYY-MM-DD)',today),value=Number(prompt('Hours planned for this day','1'));if(!day||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(value)||value<=0)return toast('Enter a valid date and positive hours.');state.tickets.push({task:tasks[index-1].id,day,hours:value});save();renderReports();};
  $('reset').onclick=()=>{if(confirm('Reset all Client Lite modules, tasks, demo clockings and Work Tickets?')){store.update(()=>seed());render();}};
  $('help').onclick=()=>alert('PAIDPRO CLIENT LITE is one browser workspace. Task-Manager plans deadlines, capacity and overtime and exports Excel. Work contains Time Card for actual hours and Project Gantt for manual dates. Reports contains weekly hours and Work Tickets. Tasks are shared across all modules; a plan never creates time clockings. Full PAIDPRO adds a central multi-user database and agents.');
  $('properties').onclick=$('company').onclick=$('database').onclick=()=>alert('Example company / Example User. This browser demo uses localStorage, not SQLite. Desktop Lite uses a local SQLite database with stable IDs for upgrade exports. No production data is accessed.');
  setInterval(()=>{const seconds=state.active?Math.floor((Date.now()-state.active.start)/1000):0;$('timer').textContent=`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;},1000);
  function sync(){state=store.get();$('workspace-warning').textContent=store.warning();$('workspace-warning').hidden=!store.warning();render();}
  store.subscribe(sync);sync();showModule(location.hash.slice(1));
  window.addEventListener('storage',e=>{if(e.key==='paidpro-task-calendar-v1'||e.key===null){renderChart();renderReports();}});
  function refreshDay(){const current=localDate(new Date()),changed=current!==today;if(changed){const previous=today;today=current;if($('report-day').value===previous)$('report-day').value=current;}if(changed||state.active){renderChart();renderReports();}}
  setInterval(refreshDay,60000);window.addEventListener('focus',refreshDay);
  const moduleFrame=$('task-manager-module');
  moduleFrame.src=moduleFrame.dataset.src;
})();
