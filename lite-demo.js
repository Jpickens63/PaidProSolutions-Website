/* Isolated browser example. Never connects to production, uploads data, or pretends to be SQLite. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), store=ClientLiteStore, uuid=()=>crypto.randomUUID();
  const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let today=localDate(new Date());
  const plus=n=>{const d=new Date();d.setDate(d.getDate()+n);return localDate(d);};
  const dateNumber=value=>{const [year,month,day]=value.split('-').map(Number);return Date.UTC(year,month-1,day)/86400000;};
  const minimumChartOffset=tasks=>{const earliest=Math.min(-7,...tasks.map(task=>dateNumber(localDate(new Date(task.createdAt)))-dateNumber(today)));return earliest>=-7?-7:-7-28*Math.ceil((-7-earliest)/28);};
  const seed=store.seed;
  let state, mode=false, noncharge=false, edited=null, editedRevision=0, contextTask=null, calendarSession, chartOffset=-7;
  state=store.get();
  const save=(expected=state.revision)=>{try{store.update(current=>{if(current.revision!==expected)throw Error('Workspace changed in another window.');return state;});return true;}catch{state=store.get();toast('Workspace changed or could not be updated. Your saved records are safe; cancel and reopen task details before retrying.');render();return false;}};
  const toast=text=>{$('toast').textContent=text;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500);};
  function cell(row,text,tag='td'){const c=document.createElement(tag);c.textContent=text;row.append(c);return c;}
  const activeTasks=()=>state.tasks.filter(t=>!t.complete&&!t.archived);
  const scheduleMode=task=>task.scheduleMode==='manual'?'manual':'auto';
  const dependencyTask=task=>task.dependsOn?state.tasks.find(item=>item.id===task.dependsOn):null;
  const dependencyBlocked=task=>Boolean(task.dependsOn&&!dependencyTask(task)?.complete);
  function schedulerInput(tasks=activeTasks()){
    const calendar=workCalendar(),automaticStart=calendar?.start>today?calendar.start:today;
    return tasks.map(task=>{const remaining=Math.max(0,task.estimate-store.chargedHours(task,state)),dependency=dependencyTask(task);return {...task,scheduleMode:scheduleMode(task),availableFrom:scheduleMode(task)==='manual'?task.start:automaticStart,dependsOn:task.dependsOn||null,dependencyComplete:Boolean(dependency?.complete),dependencyName:dependency?.name||'',active:state.active?.category==='TASK'&&state.active.task===task.id,hours:remaining,remainingHours:remaining};});
  }
  function taskPlan(tasks=activeTasks()){const calendar=workCalendar();return calendar?PaidproScheduler.plan(schedulerInput(tasks),calendar,today):null;}
  function openTasks(plan=taskPlan()){
    const rank={urgent:0,high:1,normal:2,low:3},planned=new Map((plan?.tasks||[]).map(task=>[task.id,task.start]));
    const effective=task=>planned.has(task.id)?planned.get(task.id)||'9999-12-31':task.start;
    return activeTasks().sort((a,b)=>effective(a).localeCompare(effective(b))||rank[a.priority]-rank[b.priority]||a.due.localeCompare(b.due)||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
  }
  function stop(){if(state.active){state.entries.push({...state.active,end:Date.now()});state.active=null;const saved=save();render();return saved;}return true;}
  function select(id,category='TASK'){
    const task=category==='TASK'?state.tasks.find(item=>item.id===id):null,dependency=task&&dependencyTask(task);
    if(task&&dependencyBlocked(task))return toast(`Complete "${dependency?.name||'the prerequisite task'}" before starting this task.`);
    const same=state.active&&state.active.task===id&&state.active.category===category;
    if(!confirm(same?'Stop recording time?':'Start charging time to this item?'))return;
    if(stop()===false)return;if(!same){state.active={id:uuid(),task:id,category,start:Date.now()};save();render();}
  }
  function render(){
    $('tasks').replaceChildren();
    const plan=noncharge?null:taskPlan(),planned=new Map((plan?.tasks||[]).map(task=>[task.id,task.start]));
    const rows=noncharge?['Lunch','Break','Meeting','Holiday','Vacation','Other'].map(name=>({id:name,name,category:name.toUpperCase()})):openTasks(plan);
    for(const task of rows){const tr=document.createElement('tr'),category=task.category||'TASK';
      tr.dataset.taskId=task.id;
      const dependency=category==='TASK'?dependencyTask(task):null,blocked=category==='TASK'&&dependencyBlocked(task),effectiveDate=category==='TASK'?(planned.has(task.id)?planned.get(task.id):task.start):null;
      const project=category==='TASK'?`${task.projectName} · ${task.project}`:'—',dependencyLabel=dependency?`${dependency.taskNumber} · ${dependency.name}`:'—';
      [project,task.milestone||'—',task.taskNumber||'—',task.name,task.description||'Non-project time',dependencyLabel,task.estimate?.toFixed(2)||'—',category==='TASK'?store.chargedHours(task,state).toFixed(2):'—',effectiveDate||'—',task.due||'—'].forEach((text,i)=>{const c=cell(tr,text);if(i===0)c.classList.add('project-cell');if(i===2)c.classList.add('task-code');if(i===3)c.classList.add('task-title');if(i===8){c.className='scheduled-date';if(category==='TASK'){const badge=document.createElement('span');badge.className=`schedule-badge ${scheduleMode(task)}`;badge.textContent=scheduleMode(task)==='manual'?'Manual':'Auto';c.append(badge);c.title=scheduleMode(task)==='manual'?'User-selected scheduled date':'Scheduler-assigned date';}}if(i===5&&blocked){const status=document.createElement('small');status.className='dependency-state';status.textContent='Waiting';c.append(status);}if(i===6||i===7)c.className='num';});
      if(state.active?.task===task.id)tr.classList.add('running');if(blocked){tr.classList.add('blocked');tr.setAttribute('aria-disabled','true');tr.title=`Complete ${dependency?.name||'the prerequisite task'} first`;}tr.tabIndex=0;tr.onclick=()=>select(task.id,category);tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(task.id,category);}};
      tr.oncontextmenu=e=>context(e,category==='TASK'?task.id:null);$('tasks').append(tr);
    }renderTimer();renderChart();
  }
  function context(event,id){event.preventDefault();event.stopPropagation();contextTask=id;$('context').hidden=false;$('context').style.left=Math.min(event.clientX,innerWidth-205)+'px';$('context').style.top=Math.min(event.clientY,innerHeight-230)+'px';$('context').querySelector('[data-action=edit]').disabled=!id;$('context').querySelector('[data-action=complete]').disabled=!id;$('context').querySelector('[data-action=delete]').disabled=!id;}
  function wouldCreateCycle(candidate,id){if(!candidate||!id)return false;const byId=new Map(state.tasks.map(task=>[task.id,task]));let current=byId.get(candidate);const seen=new Set();while(current&&!seen.has(current.id)){if(current.id===id)return true;seen.add(current.id);current=current.dependsOn?byId.get(current.dependsOn):null;}return false;}
  function setScheduleMode(automatic){$('schedule-mode').setAttribute('aria-checked',String(automatic));$('schedule-mode-label').textContent=automatic?'Auto Schedule':'Manual Schedule';$('schedule-mode-note').textContent=automatic?'The Scheduler assigns this date and moves the task around manual work and prerequisites.':'You control the requested start date. Auto tasks will reschedule around it.';$('start').disabled=automatic;$('start').required=!automatic;}
  function edit(id=null){edited=id;editedRevision=state.revision;const t=state.tasks.find(t=>t.id===id)||{};$('editor-title').textContent=id?'Edit Task':'Add Task';
    $('task-number').textContent=t.taskNumber||store.nextTaskNumber(state);
    for(const [input,prop] of [['project-code','project'],['project-name','projectName'],['milestone','milestone'],['task-name','name'],['description','description'],['estimate','estimate'],['priority','priority'],['due','due']])$(input).value=t[prop]??(input==='estimate'?1:input==='priority'?'normal':input==='due'?today:'');
    $('project-options').replaceChildren();$('milestone-options').replaceChildren();for(const name of new Set(state.tasks.map(t=>t.project))){const o=document.createElement('option');o.value=name;$('project-options').append(o);}for(const name of new Set(state.tasks.map(t=>t.milestone))){const o=document.createElement('option');o.value=name;$('milestone-options').append(o);}
    const dependencySelect=$('depends-on');dependencySelect.replaceChildren(new Option('No dependency',''));state.tasks.filter(item=>!item.archived&&(!item.complete||item.id===t.dependsOn)&&item.id!==id&&!wouldCreateCycle(item.id,id)).sort((a,b)=>a.taskNumber.localeCompare(b.taskNumber)).forEach(item=>dependencySelect.append(new Option(`${item.taskNumber} · ${item.name}`,item.id)));dependencySelect.value=t.dependsOn||'';
    const automatic=scheduleMode(t)==='auto',planned=id?taskPlan()?.tasks.find(task=>task.id===id)?.start:null;$('start').value=automatic?(planned||''):(t.start||today);setScheduleMode(automatic);$('editor').showModal();
  }
  $('schedule-mode').onclick=()=>{const automatic=$('schedule-mode').getAttribute('aria-checked')!=='true';if(!automatic&&!$('start').value)$('start').value=(edited?taskPlan()?.tasks.find(task=>task.id===edited)?.start:null)||today;setScheduleMode(automatic);};
  $('task-form').onsubmit=e=>{e.preventDefault();const estimate=Number($('estimate').value),automatic=$('schedule-mode').getAttribute('aria-checked')==='true',existing=state.tasks.find(t=>t.id===edited),start=automatic?(existing?.start||today):$('start').value,due=$('due').value,dependsOn=$('depends-on').value||null;if(!Number.isFinite(estimate)||estimate<=0||!due||!start||(!automatic&&due<start)){toast('Enter positive hours and a complete-by date on or after the manual start.');return;}if(wouldCreateCycle(dependsOn,edited))return toast('Choose a prerequisite that does not create a dependency loop.');
    const task={id:edited||uuid(),taskNumber:existing?.taskNumber||store.nextTaskNumber(state),project:$('project-code').value.trim().toUpperCase(),projectName:$('project-name').value.trim(),milestone:$('milestone').value.trim(),name:$('task-name').value.trim(),description:$('description').value.trim(),estimate,start,due,priority:$('priority').value,scheduleMode:automatic?'auto':'manual',dependsOn,createdAt:existing?.createdAt||Date.now(),complete:false,archived:false};
    if(!task.project||!task.projectName||!task.milestone||!task.name)return toast('Enter a project, milestone and task name.');
    if(edited)state.tasks=state.tasks.map(t=>t.id===edited?{...t,...task}:t);else state.tasks.push(task);const saved=save(edited?editedRevision:state.revision);if(saved)$('editor').close();render();};
  function deleteTask(id){
    const task=state.tasks.find(t=>t.id===id);
    if(!task)return;
    if(state.active?.category==='TASK'&&state.active.task===id)return toast('Stop the timer before deleting this task.');
    const dependent=state.tasks.find(item=>!item.complete&&!item.archived&&item.dependsOn===id);if(dependent)return toast(`Remove the dependency from "${dependent.name}" before deleting this task.`);
    const hasHistory=state.entries.some(entry=>entry.category==='TASK'&&entry.task===id)||state.tickets.some(ticket=>ticket.task===id);
    const message=hasHistory?`Delete "${task.name}" from Client LITE? Existing clockings and Work Tickets will be preserved.`:`Delete "${task.name}" from Client LITE? This cannot be undone.`;
    if(!confirm(message))return;
    const expectedRevision=state.revision;
    task.archived=true;
    if(save(expectedRevision)){render();toast(hasHistory?'Task deleted from Client LITE. Its history was preserved.':'Task deleted.');}
  }
  $('cancel').onclick=()=>$('editor').close();$('add').onclick=()=>edit();$('card').oncontextmenu=e=>context(e,null);
  $('context').onclick=e=>{const action=e.target.dataset.action;$('context').hidden=true;if(action==='add')edit();if(action==='edit'&&contextTask)edit(contextTask);if(action==='stop')stop();if(action==='complete'&&contextTask){if(state.active?.task===contextTask&&stop()===false)return;state.tasks.find(t=>t.id===contextTask).complete=true;save();render();}if(action==='delete'&&contextTask)deleteTask(contextTask);};
  document.addEventListener('click',e=>{if(!$('context').contains(e.target))$('context').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('context').hidden=true;});
  $('mode').onclick=()=>{mode=!mode;$('mode').setAttribute('aria-checked',String(mode));$('mode-label').textContent=mode?'Project Gantt':'Time Card';$('card').hidden=mode;$('gantt').hidden=!mode;$('charge-control').hidden=mode;renderChart();if(mode)center();};
  $('charge').onclick=()=>{noncharge=!noncharge;$('charge').setAttribute('aria-checked',String(noncharge));$('charge-label').textContent=noncharge?'Non-Chargeable':'Chargeable';render();};
  function workCalendar(){
    if(calendarSession!==undefined)return calendarSession;
    let raw=null;try{raw=localStorage.getItem('paidpro-task-calendar-v1');}catch{}
    return PaidproGanttHours.calendar(raw,today);
  }
  function renderChart(){
    const calendar=workCalendar(),tasks=openTasks(),minimumOffset=minimumChartOffset(tasks);chartOffset=Math.max(chartOffset,minimumOffset);
    $('gantt-paging').hidden=!mode;
    if(!calendar){$('chart').replaceChildren();$('gantt-paging').hidden=true;$('work-hint').textContent=mode?'Check the work calendar in Task-Manager before scheduling.':noncharge?'Click a time category to start, switch or stop. Right-click for more actions.':'The Scheduler sets Auto task dates. Manual dates and completed prerequisites take priority.';return;}
    const summary=PaidproGanttHours.calculate(schedulerInput(tasks),calendar,plus(chartOffset),plus(chartOffset+27),today);
    $('gantt-range').textContent=`${summary.days[0].date} – ${summary.days.at(-1).date}`;
    $('gantt-previous').disabled=chartOffset<=minimumOffset;
    $('gantt-next').disabled=plus(chartOffset+28)>summary.schedule.days.at(-1).date;
    const hours=new Intl.NumberFormat(undefined,{maximumFractionDigits:2}),table=$('chart');table.replaceChildren();
    const head=document.createElement('thead'),h=document.createElement('tr'),label=cell(h,'Task / Project / Milestone','th');label.scope='col';
    const note=document.createElement('small');note.className='gantt-heading-note';note.textContent='Daily hours · green leading line = task created date · red trailing line = complete-by date';label.append(note);
    for(const day of summary.days){const c=cell(h,new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date(day.date+'T12:00:00')),'th');c.scope='col';c.dataset.date=day.date;
      if(day.date===today)c.classList.add('today');if(!day.available)c.classList.add('off-day');
      const available=document.createElement('small');available.className='gantt-available';available.textContent=`Available ${hours.format(day.available)} hr`;
      const assigned=document.createElement('small');assigned.className='gantt-assigned';assigned.textContent=`Assigned ${hours.format(day.assigned)} hr`;
      if(day.overtime){assigned.classList.add('overtime');c.title=`${hours.format(day.overtime)} extra hr planned; daily extra limit ${hours.format(day.extraAvailable)} hr`;}
      c.append(available,assigned);}
    head.append(h);table.append(head);const body=document.createElement('tbody');
    for(const task of summary.tasks){const row=document.createElement('tr');row.dataset.taskId=task.id;const createdDate=localDate(new Date(task.createdAt));const label=cell(row,`${task.taskNumber} · ${task.name} / ${task.projectName} · ${task.milestone}`);label.title=`${task.scheduleMode==='manual'?'Manual':'Auto'} schedule · created ${createdDate} · complete by ${task.due} · planned ${task.start||'Unscheduled'} → ${task.finish||'Not fully scheduled'} · ${task.status}${task.dependencyName?` · depends on ${task.dependencyNumber||''} ${task.dependencyName}`:''}`;row.ondblclick=()=>edit(task.id);
      for(const day of summary.days){const c=cell(row,'');if(day.date===today)c.classList.add('today');const markers=[];if(day.date===createdDate){c.classList.add('task-created-date');markers.push(`created date ${createdDate}`);}if(day.date===task.due){c.classList.add('task-complete-date');markers.push(`complete-by date ${task.due}`);}const a=day.allocations.find(a=>a.id===task.id);if(a){const block=document.createElement('div');block.className=`block ${day.date>task.due?'late-work':a.overtime?'extra-work':'normal-work'}`;block.textContent=`${hours.format(a.hours)} hr`;block.title=`${task.name}: ${task.start} → ${task.finish||'Not fully scheduled'} · ${hours.format(a.regular)} normal + ${hours.format(a.overtime)} extra hr on ${day.date}`;block.tabIndex=0;block.setAttribute('aria-label',block.title);c.append(block);}if(markers.length){c.title=`${task.name}: ${markers.join(' and ')}`;if(!a){c.tabIndex=0;c.setAttribute('aria-label',c.title);}}c.onclick=()=>{table.querySelectorAll('.selected').forEach(c=>c.classList.remove('selected'));c.classList.add('selected');};}body.append(row);
    }table.append(body);
    $('work-hint').textContent=mode?`Auto tasks are recalculated around Manual dates and prerequisites. A dependent task waits for its prerequisite to finish. A running task stays first. Available: ${hours.format(calendar.regular)} normal hr/day, up to ${hours.format(calendar.overtime)} extra. Amber includes extra hours; rose marks late work.${summary.schedule.blockedCount?` ${summary.schedule.blockedCount} task(s) are blocked by a prerequisite.`:''}${summary.schedule.lateCount?` ${summary.schedule.lateCount} deadline(s) missed or at risk.`:''}${summary.unscheduled.length?' Some hours fall outside the two-year plan.':''}${calendar.fallback?' Calendar settings are session-only; check Task-Manager for details.':''}`:noncharge?'Click a time category to start, switch or stop. Right-click for more actions.':'The Scheduler sets Auto task dates. Manual dates and completed prerequisites take priority. Click a task to start, switch or stop; right-click for task actions.';
  }
  $('gantt-previous').onclick=()=>{chartOffset=Math.max(minimumChartOffset(openTasks()),chartOffset-28);renderChart();};
  $('gantt-next').onclick=()=>{chartOffset+=28;renderChart();};
  $('gantt-today').onclick=()=>{chartOffset=-7;renderChart();center();};
  function center(){requestAnimationFrame(()=>{const day=$('chart').querySelector('th.today'),labelWidth=$('chart').querySelector('th')?.offsetWidth||280;if(day){const viewport=$('gantt').getBoundingClientRect(),rect=day.getBoundingClientRect();$('gantt').scrollLeft=Math.max(0,$('gantt').scrollLeft+rect.left+rect.width/2-viewport.left-labelWidth-($('gantt').clientWidth-labelWidth)/2);}});}
  function showModule(name) {
    if(!['work','task-manager'].includes(name))name='work';
    document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b.dataset.tab===name;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});
    ['work','task-manager'].forEach(id=>{$(id).hidden=id!==name;});
    if(location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);
    if(name==='work'){renderChart();if(mode)center();}
  }
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>showModule(button.dataset.tab));
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...document.querySelectorAll('[data-tab]')],i=buttons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length;buttons[next].focus();showModule(buttons[next].dataset.tab);}));
  window.addEventListener('hashchange',()=>showModule(location.hash.slice(1)));
  $('reset').onclick=()=>{if(confirm('Reset all Client Lite modules, tasks, demo clockings and Work Tickets?')){store.update(()=>seed());render();}};
  $('help').onclick=()=>alert('PAIDPRO CLIENT LITE is one browser workspace. Every task receives a permanent TASK-001 style number. New tasks use Auto Schedule, so the Scheduler assigns their dates. Switching a task to Manual enables its date and makes Auto tasks recalculate around it. A dependent task cannot start until its selected prerequisite is complete. A running task stays first. Task-Manager sets the calendar and exports the same plan to Excel. A plan never creates clockings. Full PAIDPRO adds a central multi-user database and agents.');
  $('properties').onclick=$('company').onclick=$('database').onclick=()=>alert('Example company / Example User. This browser demo uses localStorage, not SQLite. Desktop Lite uses a local SQLite database with stable IDs for upgrade exports. No production data is accessed.');
  function renderTimer(){const seconds=state.active?Math.max(0,Math.floor((Date.now()-state.active.start)/1000)):0;$('timer').textContent=`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  setInterval(renderTimer,1000);
  function sync(){state=store.get();$('workspace-warning').textContent=store.warning();$('workspace-warning').hidden=!store.warning();render();}
  store.subscribe(sync);sync();showModule(location.hash.slice(1));
  window.addEventListener('paidpro-calendar-change',e=>{calendarSession=e.detail;chartOffset=-7;renderChart();});
  // Once loaded, the embedded planner owns session settings and notifies Work.
  // Storage events can arrive in either frame first; do not overwrite its session.
  window.addEventListener('storage',e=>{if(e.key==='paidpro-task-calendar-v1'||e.key===null)renderChart();});
  function refreshDay(){const current=localDate(new Date()),changed=current!==today;if(changed)today=current;if(changed||state.active)renderChart();}
  setInterval(refreshDay,60000);window.addEventListener('focus',refreshDay);
  const moduleFrame=$('task-manager-module');
  moduleFrame.src=moduleFrame.dataset.src;
})();
