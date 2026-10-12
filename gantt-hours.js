/* Read-only load summary for manually dated Project Gantt tasks. */
(function(root){
  'use strict';
  const DAY=86400000,number=s=>Date.parse(`${s}T00:00:00Z`)/DAY,date=n=>new Date(n*DAY).toISOString().slice(0,10);
  const defaults=()=>({regular:8,weekdays:[1,2,3,4,5],excluded:[],fallback:false});
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(number(s))&&date(number(s))===s;
  function calendar(raw){
    if(!raw)return defaults();
    try{
      const c=JSON.parse(raw);
      if(c.version!==1||!Number.isFinite(c.regular)||c.regular<.01||c.regular>24||!Array.isArray(c.weekdays)||!c.weekdays.length||c.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||!Array.isArray(c.excluded)||c.excluded.length>100||c.excluded.some(d=>!validDate(d)))throw Error();
      return {regular:c.regular,weekdays:[...new Set(c.weekdays)],excluded:[...new Set(c.excluded)],fallback:false};
    }catch{return {...defaults(),fallback:true};}
  }
  function calculate(tasks,settings,first,last){
    const weekdays=new Set(settings.weekdays),excluded=new Set(settings.excluded.map(number));
    const weekday=n=>new Date(n*DAY).getUTCDay(),working=n=>weekdays.has(weekday(n))&&!excluded.has(n);
    function workingCount(from,to){
      if(to<from)return 0;
      const length=to-from+1,weeks=Math.floor(length/7);let total=weeks*weekdays.size;
      for(let i=weeks*7;i<length;i++)if(weekdays.has(weekday(from+i)))total++;
      for(const n of excluded)if(n>=from&&n<=to&&weekdays.has(weekday(n)))total--;
      return total;
    }
    const start=number(first),end=number(last);
    if(!validDate(first)||!validDate(last)||end<start||end-start>3660)throw Error('Invalid Gantt window');
    const days=Array.from({length:end-start+1},(_,i)=>({date:date(start+i),available:working(start+i)?settings.regular:0,assigned:0,allocations:[]})),unscheduled=[];
    for(const task of tasks){
      const units=Math.max(0,Math.round(task.remainingHours*100));if(!units)continue;
      if(!validDate(task.start)||!validDate(task.due)||task.due<task.start){unscheduled.push(task.id);continue;}
      const from=number(task.start),to=number(task.due),count=workingCount(from,to);
      if(!count){unscheduled.push(task.id);continue;}
      const base=Math.floor(units/count),extra=units%count;
      for(const day of days){
        const n=number(day.date);if(n<from||n>to||!working(n))continue;
        const amount=base+(workingCount(from,n)<=extra?1:0);
        day.assigned+=amount;if(amount)day.allocations.push({id:task.id,hours:amount/100});
      }
    }
    days.forEach(d=>{d.assigned/=100;d.overloaded=Math.round(d.assigned*100)>Math.round(d.available*100);});
    return {days,unscheduled};
  }
  const api={calendar,calculate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PaidproGanttHours=api;
})(globalThis);
