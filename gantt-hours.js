/* Project Gantt projects the same decision-matrix plan as Task-Manager. */
(function(root){
  'use strict';
  const DAY=86400000,number=s=>Date.parse(`${s}T00:00:00Z`)/DAY,date=n=>new Date(n*DAY).toISOString().slice(0,10);
  const scheduler=typeof module!=='undefined'&&module.exports?require('./task-scheduler.js'):root.PaidproScheduler;
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const defaults=(today)=>({start:today,regular:8,overtime:2,weekdays:[1,2,3,4,5],excluded:[],fallback:false});
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(number(s))&&date(number(s))===s;
  function calendar(raw,today=localDate()){
    if(!raw)return defaults(today);
    try{
      const c=JSON.parse(raw);
      if(c.version!==1||!validDate(c.start)||c.start<'1900-01-01'||!Number.isFinite(c.regular)||c.regular<.01||!Number.isFinite(c.overtime)||c.overtime<0||c.regular+c.overtime>24||!Array.isArray(c.weekdays)||!c.weekdays.length||c.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||!Array.isArray(c.excluded)||c.excluded.length>100||c.excluded.some(d=>!validDate(d)||d<'1900-01-01'))throw Error();
      return {...c,weekdays:[...new Set(c.weekdays)],excluded:[...new Set(c.excluded)],fallback:false};
    }catch{return {...defaults(today),fallback:true};}
  }
  function calculate(tasks,settings,first,last,today=localDate()){
    const weekdays=new Set(settings.weekdays),excluded=new Set(settings.excluded);
    const start=number(first),end=number(last);
    if(!validDate(first)||!validDate(last)||end<start||end-start>3660)throw Error('Invalid Gantt window');
    const automaticStart=settings.start>today?settings.start:today;
    const schedule=scheduler.plan(tasks.map(t=>({...t,scheduleMode:t.scheduleMode==='manual'?'manual':'auto',availableFrom:t.scheduleMode==='manual'?t.start:automaticStart,hours:Math.max(0,Math.round(t.remainingHours*100)/100)})),settings,today);
    const planned=new Map(schedule.days.map(d=>[d.date,d]));
    const days=Array.from({length:end-start+1},(_,i)=>{
      const value=date(start+i),working=weekdays.has(new Date((start+i)*DAY).getUTCDay())&&!excluded.has(value),d=planned.get(value);
      const allocations=new Map();
      for(const a of d?.allocations||[]){const item=allocations.get(a.id)||{id:a.id,regular:0,overtime:0,hours:0};item[a.type]+=a.hours;item.hours=Math.round((item.regular+item.overtime)*100)/100;allocations.set(a.id,item);}
      return {date:value,available:working?settings.regular:0,extraAvailable:working?settings.overtime:0,assigned:d?Math.round((d.regular+d.overtime)*100)/100:0,overtime:d?.overtime||0,allocations:[...allocations.values()]};
    });
    return {days,tasks:schedule.tasks,schedule,unscheduled:schedule.tasks.filter(t=>t.unplannedHours>0).map(t=>t.id)};
  }
  const api={calendar,calculate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PaidproGanttHours=api;
})(globalThis);
