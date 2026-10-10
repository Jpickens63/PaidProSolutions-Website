/* Isolated browser example. Never connects to production, uploads data, or pretends to be SQLite. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), key='paidpro-lite-example-v1', uuid=()=>crypto.randomUUID();
  const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today=localDate(new Date()), plus=n=>{const d=new Date();d.setDate(d.getDate()+n);return localDate(d);};
  const seed=()=>({tasks:[{id:uuid(),project:'DEMO001',projectName:'Workshop improvement',milestone:'Design ready',name:'Concept layout',description:'Review the layout and record design time',estimate:3,start:today,due:plus(2),complete:false},{id:uuid(),project:'DEMO001',projectName:'Workshop improvement',milestone:'Design ready',name:'Detail drawing',description:'Produce the detail drawing',estimate:4,start:plus(1),due:plus(4),complete:false},{id:uuid(),project:'DEMO002',projectName:'Calibration tooling',milestone:'Prototype ready',name:'Prototype review',description:'Inspect the fit and document observations',estimate:1,start:today,due:plus(1),complete:false}],entries:[],tickets:[],active:null});
  let state, mode=false, noncharge=false, edited=null, contextTask=null;
  try{state=JSON.parse(localStorage.getItem(key))||seed();if(!Array.isArray(state.tasks)||!Array.isArray(state.entries)||!Array.isArray(state.tickets))throw Error();}catch{state=seed();}
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{toast('Browser storage unavailable; this example will not survive reload.');}};
  const toast=text=>{$('toast').textContent=text;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500);};
  function cell(row,text,tag='td'){const c=document.createElement(tag);c.textContent=text;row.append(c);return c;}
  function elapsed(entry){return Math.max(0,((entry.end||Date.now())-entry.start)/3600000);}
  function stop(){if(state.active){state.entries.push({...state.active,end:Date.now()});state.active=null;save();render();}}
  function select(id,category='TASK'){
    const same=state.active&&state.active.task===id&&state.active.category===category;
    if(!confirm(same?'Stop recording time?':'Start charging time to this item?'))return;
    stop();if(!same){state.active={id:uuid(),task:id,category,start:Date.now()};save();render();}
  }
  function render(){
    $('tasks').replaceChildren();
    const rows=noncharge?['Lunch','Break','Meeting','Holiday','Vacation','Other'].map(name=>({id:name,name,category:name.toUpperCase()})):state.tasks.filter(t=>!t.complete);
    for(const task of rows){const tr=document.createElement('tr'),category=task.category||'TASK';
      [task.project||'—',task.milestone||'—',task.name,task.description||'Non-project time',task.estimate?.toFixed(2)||'—',category==='TASK'?state.entries.filter(e=>e.task===task.id).reduce((n,e)=>n+elapsed(e),0).toFixed(2):'—',task.due||'—'].forEach(text=>cell(tr,text));
      if(state.active?.task===task.id)tr.classList.add('running');tr.tabIndex=0;tr.onclick=()=>select(task.id,category);tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(task.id,category);}};
      tr.oncontextmenu=e=>context(e,category==='TASK'?task.id:null);$('tasks').append(tr);
    }renderChart();renderReports();
  }
  function context(event,id){event.preventDefault();event.stopPropagation();contextTask=id;$('context').hidden=false;$('context').style.left=Math.min(event.clientX,innerWidth-205)+'px';$('context').style.top=Math.min(event.clientY,innerHeight-190)+'px';$('context').querySelector('[data-action=edit]').disabled=!id;$('context').querySelector('[data-action=complete]').disabled=!id;}
  function edit(id=null){edited=id;const t=state.tasks.find(t=>t.id===id)||{};$('editor-title').textContent=id?'Edit Task':'Add Task';
    for(const [input,prop] of [['project-code','project'],['project-name','projectName'],['milestone','milestone'],['task-name','name'],['description','description'],['estimate','estimate'],['start','start'],['due','due']])$(input).value=t[prop]??(input==='estimate'?1:input==='start'||input==='due'?today:'');
    $('project-options').replaceChildren();$('milestone-options').replaceChildren();for(const name of new Set(state.tasks.map(t=>t.project))){const o=document.createElement('option');o.value=name;$('project-options').append(o);}for(const name of new Set(state.tasks.map(t=>t.milestone))){const o=document.createElement('option');o.value=name;$('milestone-options').append(o);}$('editor').showModal();
  }
  $('task-form').onsubmit=e=>{e.preventDefault();const estimate=Number($('estimate').value),start=$('start').value,due=$('due').value;if(!Number.isFinite(estimate)||estimate<=0||due<start){toast('Enter positive hours and a complete-by date on or after start.');return;}
    const task={id:edited||uuid(),project:$('project-code').value.trim().toUpperCase(),projectName:$('project-name').value.trim(),milestone:$('milestone').value.trim(),name:$('task-name').value.trim(),description:$('description').value.trim(),estimate,start,due,complete:false};
    if(edited)state.tasks=state.tasks.map(t=>t.id===edited?{...t,...task}:t);else state.tasks.push(task);save();$('editor').close();render();};
  $('cancel').onclick=()=>$('editor').close();$('add').onclick=()=>edit();$('card').oncontextmenu=e=>context(e,null);
  $('context').onclick=e=>{const action=e.target.dataset.action;$('context').hidden=true;if(action==='add')edit();if(action==='edit'&&contextTask)edit(contextTask);if(action==='stop')stop();if(action==='complete'&&contextTask){if(state.active?.task===contextTask)stop();state.tasks.find(t=>t.id===contextTask).complete=true;save();render();}};
  document.addEventListener('click',e=>{if(!$('context').contains(e.target))$('context').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('context').hidden=true;});
  $('mode').onclick=()=>{mode=!mode;$('mode').setAttribute('aria-checked',String(mode));$('mode-label').textContent=mode?'Project Gantt':'Time Card';$('card').hidden=mode;$('gantt').hidden=!mode;$('charge-control').hidden=mode;if(mode)center();};
  $('charge').onclick=()=>{noncharge=!noncharge;$('charge').setAttribute('aria-checked',String(noncharge));$('charge-label').textContent=noncharge?'Non-Chargeable':'Chargeable';render();};
  function renderChart(){const table=$('chart');table.replaceChildren();const head=document.createElement('thead'),h=document.createElement('tr');cell(h,'Project / Milestone / Task','th');
    const days=[];for(let n=-7;n<=21;n++){const day=plus(n);days.push(day);const c=cell(h,day.slice(5),'th');if(day===today)c.className='today';}head.append(h);table.append(head);const body=document.createElement('tbody');
    for(const task of state.tasks.filter(t=>!t.complete)){const row=document.createElement('tr');cell(row,`${task.project} · ${task.milestone} / ${task.name}`);row.ondblclick=()=>edit(task.id);
      for(const day of days){const c=cell(row,'');if(day===today)c.className='today';if(day>=task.start&&day<=task.due){const block=document.createElement('div');block.className='block';block.title=`${task.name}: ${task.start} → ${task.due}`;c.append(block);}c.onclick=()=>{table.querySelectorAll('.selected').forEach(c=>c.classList.remove('selected'));c.classList.add('selected');};}body.append(row);
    }table.append(body);}
  function center(){requestAnimationFrame(()=>{$('gantt').scrollLeft=Math.max(0,280+7*84-$('gantt').clientWidth/2);});}
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));$('work').hidden=button.dataset.tab!=='work';$('reports').hidden=button.dataset.tab!=='reports';renderReports();});
  const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));$('week').value=localDate(monday);
  function renderReports(){const table=$('report-table');table.replaceChildren();const reportMode=$('report-mode').value,start=new Date($('week').value+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+7);if(!Number.isFinite(start.getTime()))return;
    const head=document.createElement('thead'),h=document.createElement('tr'),body=document.createElement('tbody');
    if(reportMode==='ticket'){['Date','Project','Task','Planned Hours'].forEach(t=>cell(h,t,'th'));for(const t of state.tickets.filter(t=>t.day>=localDate(start)&&t.day<localDate(end))){const task=state.tasks.find(a=>a.id===t.task),r=document.createElement('tr');[t.day,task?.project||'—',task?.name||'—',t.hours.toFixed(2)].forEach(v=>cell(r,v));body.append(r);}}
    else if(reportMode==='entries'){['Project','Task / Category','Clock In','Clock Out','Hours'].forEach(t=>cell(h,t,'th'));for(const e of state.entries.filter(e=>e.start<end.getTime()&&e.end>start.getTime())){const t=state.tasks.find(t=>t.id===e.task),r=document.createElement('tr');[t?.project||'—',t?.name||e.category,new Date(e.start).toLocaleString(),new Date(e.end).toLocaleString(),elapsed(e).toFixed(2)].forEach(v=>cell(r,v));body.append(r);}}
    else{[reportMode==='projects'?'Project':'Project / Task','Mon','Tue','Wed','Thu','Fri','Sat','Sun','Total'].forEach(t=>cell(h,t,'th'));const groups=new Map();for(const e of state.entries){const t=state.tasks.find(t=>t.id===e.task),label=t?(reportMode==='projects'?t.project:`${t.project} / ${t.name}`):e.category;for(let d=0;d<7;d++){const a=new Date(start),b=new Date(start);a.setDate(a.getDate()+d);b.setDate(b.getDate()+d+1);const value=Math.max(0,Math.min(e.end,b.getTime())-Math.max(e.start,a.getTime()))/3600000;if(value){if(!groups.has(label))groups.set(label,Array(7).fill(0));groups.get(label)[d]+=value;}}}for(const [label,values] of groups){const r=document.createElement('tr');[label,...values.map(n=>n.toFixed(2)),values.reduce((a,b)=>a+b,0).toFixed(2)].forEach(v=>cell(r,v));body.append(r);}}
    head.append(h);table.append(head,body);$('plan').hidden=reportMode!=='ticket';}
  $('week').onchange=renderReports;$('report-mode').onchange=renderReports;$('print').onclick=()=>window.print();
  $('plan').onclick=()=>{const tasks=state.tasks.filter(t=>!t.complete);if(!tasks.length)return toast('Add a task first.');const index=Number(prompt(tasks.map((t,i)=>`${i+1}. ${t.project} · ${t.name}`).join('\n')+'\nEnter task number:'));if(!Number.isInteger(index)||index<1||index>tasks.length)return;const day=prompt('Work date (YYYY-MM-DD)',today),value=Number(prompt('Hours planned for this day','1'));if(!day||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(value)||value<=0)return toast('Enter a valid date and positive hours.');state.tickets.push({task:tasks[index-1].id,day,hours:value});save();renderReports();};
  $('reset').onclick=()=>{if(confirm('Reset this browser example and its demo clockings?')){state=seed();save();render();}};
  $('help').onclick=()=>alert('This is an isolated example of desktop Client Lite. Use Time Card for actual hours, Work Ticket for planned daily work, and Project Gantt for manually entered dates. Full PAIDPRO adds a central multi-user database, scheduling and agents.');
  $('properties').onclick=$('company').onclick=$('database').onclick=()=>alert('Example company / Example User. This browser demo uses localStorage, not SQLite. Desktop Lite uses a local SQLite database with stable IDs for upgrade exports. No production data is accessed.');
  setInterval(()=>{const seconds=state.active?Math.floor((Date.now()-state.active.start)/1000):0;$('timer').textContent=`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;},1000);
  save();render();
})();
