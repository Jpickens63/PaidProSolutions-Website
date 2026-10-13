const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const scheduler = require('../task-scheduler.js');
const gantt = require('../gantt-hours.js');
const today = '2026-10-12';
const calendar = (extra = {}) => ({ start: today, regular: 8, overtime: 2, weekdays: [1,2,3,4,5], excluded: [], ...extra });
const task = (id, hours, due = '2026-10-16', extra = {}) => ({ id, name: id, description: '', hours, due, priority: 'normal', createdAt: 1, ...extra });
const cents = value => Math.round(value * 100);
function invariants(result, input) {
  const completed = new Set(); let current;
  for (const day of result.days) {
    assert.ok(cents(day.regular) <= cents(day.regularCapacity));
    assert.ok(cents(day.overtime) <= cents(day.overtimeCapacity));
    if (!day.working) assert.equal(day.allocations.length, 0);
    assert.equal(day.allocations.reduce((sum, a) => sum + cents(a.hours), 0), cents(day.regular) + cents(day.overtime));
    for (const allocation of day.allocations) {
      if (allocation.id !== current) {
        assert.ok(!completed.has(allocation.id), `Task ${allocation.id} reappeared after switching away`);
        if (current) completed.add(current);
        current = allocation.id;
      }
    }
  }
  for (const item of result.tasks) {
    assert.equal(cents(item.regularHours) + cents(item.overtimeHours) + cents(item.unplannedHours), cents(input.find(t => t.id === item.id).hours));
    assert.ok(item.allocations.every(a => a.date >= result.start && (item.active || a.date >= (item.availableFrom || result.start))));
    if (item.status.startsWith('On time')) assert.ok(item.finish <= item.due && !item.unplannedHours && !item.shortageHours);
  }
}
test('three tasks get full working blocks, never three small daily shares', () => {
  const input = ['A','B','C'].map(id => task(id, 10));
  const result = scheduler.plan(input, calendar({ overtime: 0 }), today);
  assert.deepEqual(result.tasks.map(t => t.allocations), [
    [{date:today,regular:8,overtime:0},{date:'2026-10-13',regular:2,overtime:0}],
    [{date:'2026-10-13',regular:6,overtime:0},{date:'2026-10-14',regular:4,overtime:0}],
    [{date:'2026-10-14',regular:4,overtime:0},{date:'2026-10-15',regular:6,overtime:0}]
  ]);
  invariants(result, input);
});
test('matrix reproduces VBA coefficients and priority weights', () => {
  assert.deepEqual(scheduler.decision(20, 4, 'high'), {daysLeft:4,priorityWeight:1,burn:5,score:251050});
  assert.equal(scheduler.decision(1, 0, 'urgent').score, 1002010);
  assert.equal(scheduler.decision(1, 1, 'low').priorityWeight, 0);
  const input = [task('normal', 1),task('urgent', 1, undefined, {priority:'urgent'}),task('larger', 2, undefined, {priority:'urgent'})];
  assert.deepEqual(scheduler.plan(input, calendar(), today).tasks.map(t => t.id), ['larger','urgent','normal']);
});
test('a running task stays selected even when another deadline is closer', () => {
  const input = [task('running', 12, undefined, {active:true,availableFrom:'2026-11-01'}),task('urgent', 1, today, {priority:'urgent'})];
  const result = scheduler.plan(input, calendar({overtime:0}), today);
  assert.equal(result.tasks[0].id, 'running');
  assert.equal(result.tasks[1].start, '2026-10-13');
  assert.equal(result.tasks[1].shortageHours, 1);
  invariants(result, input);
});
test('scheduled availability, weekends and days off are honored', () => {
  const input = [task('A', 9, '2026-10-20', {availableFrom:'2026-10-16'})];
  const result = scheduler.plan(input, calendar({excluded:['2026-10-16'],overtime:0}), today);
  assert.equal(result.tasks[0].start, '2026-10-19');
  assert.equal(result.tasks[0].finish, '2026-10-20');
  invariants(result, input);
});
test('normal and extra hours remain chronological inside a task block', () => {
  const input = [task('A', 20, '2026-10-13'),task('B', 3)];
  const result = scheduler.plan(input, calendar(), today);
  assert.equal(result.plannedOvertime, 4);
  assert.equal(result.requiredOvertime, 4);
  assert.equal(result.lateCount, 0);
  assert.equal(result.tasks[1].start, '2026-10-14');
  invariants(result, input);
});
test('insufficient overtime flags the real deadline shortage and schedules catch-up', () => {
  const input = [task('A', 16, today),task('B', 1)];
  const result = scheduler.plan(input, calendar(), today);
  assert.equal(result.plannedOvertime, 2);
  assert.equal(result.requiredOvertime, 8);
  assert.equal(result.tasks[0].shortageHours, 6);
  assert.equal(result.tasks[0].finish, '2026-10-13');
  invariants(result, input);
});
test('past deadlines and impossible availability cannot be reported on time', () => {
  const result = scheduler.plan([task('past', 4, '2026-10-11'),task('future', 8, today),task('unavailable', 2, today, {availableFrom:'2026-10-13'})], calendar(), today);
  assert.equal(result.tasks.find(t => t.id==='past').status, 'Already overdue');
  assert.equal(result.tasks.find(t => t.id==='unavailable').status, 'Deadline at risk');
  assert.equal(result.tasks.find(t => t.id==='future').start, today);
  assert.equal(result.plannedOvertime, 0);
});
test('hundredths and horizon limits conserve every hour without backdating', () => {
  const small = [task('A', .01, today),task('B', .02, today)];
  const result = scheduler.plan(small, calendar({regular:.02,overtime:.01,start:'2026-10-01'}), today);
  assert.equal(result.requiredOvertime, .01);
  invariants(result, small);
  const huge = [task('A',100000,today),task('B',1,'9999-12-31')];
  const bounded = scheduler.plan(huge, calendar({overtime:0}), today);
  assert.equal(bounded.beyondCount, 1);
  assert.ok(bounded.unplannedHours > 0);
  invariants(bounded, huge);
  const rounded=scheduler.plan([task('rounding',24,today)],calendar({regular:12.005,overtime:11.995}),today);
  assert.ok(cents(rounded.days[0].regular)+cents(rounded.days[0].overtime)<=2400);
});
test('Project Gantt projects exactly the shared planner, including extra hours', () => {
  const input = [task('A',20,'2026-10-13'),task('B',3)];
  const settings = calendar(), result = scheduler.plan(input,settings,today);
  const projection = gantt.calculate(input.map(t => ({...t,start:today,remainingHours:t.hours})), settings,today,'2026-10-20',today);
  const comparable=t=>({id:t.id,order:t.order,start:t.start,finish:t.finish,status:t.status,allocations:t.allocations});
  assert.deepEqual(projection.schedule.tasks.map(comparable), result.tasks.map(comparable));
  for (const day of projection.days) {
    const planned = result.days.find(d => d.date===day.date);
    assert.equal(cents(day.assigned),cents(planned.regular)+cents(planned.overtime));
    for (const item of result.tasks) {
      const a=item.allocations.find(a=>a.date===day.date);
      assert.equal(cents(day.allocations.find(a=>a.id===item.id)?.hours||0),cents((a?.regular||0)+(a?.overtime||0)));
    }
  }
});
test('calendar parsing keeps plan start and overtime, and preserves unreadable data', () => {
  const raw = JSON.stringify({version:1,...calendar({start:'2026-10-20',overtime:3})});
  assert.equal(gantt.calendar(raw,today).start,'2026-10-20');
  assert.equal(gantt.calendar(raw,today).overtime,3);
  assert.equal(gantt.calendar('{broken',today).fallback,true);
});
test('planning reads charged time, availability and active state without mutating history', () => {
  const now=Date.now(), saved={version:2,revision:7,tasks:[{...task('A',10),hours:undefined,estimate:10,start:today,project:'DEMO',projectName:'Demo',milestone:'Design',complete:false,archived:false}],entries:[{id:'e',task:'A',category:'TASK',start:now-7200000,end:now-3600000}],tickets:[],active:{id:'timer',task:'A',category:'TASK',start:now-3600000}};
  const raw=JSON.stringify(saved); let writes=0;
  const context={localStorage:{getItem:()=>raw,setItem:()=>writes++},window:{addEventListener(){}},crypto:require('node:crypto').webcrypto};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../lite-store.js'),'utf8'),context);
  const before=JSON.stringify(context.ClientLiteStore.get()),input=context.ClientLiteStore.managerTasks();
  assert.equal(input[0].availableFrom,today);assert.equal(input[0].active,true);
  assert.ok(input[0].chargedHours>=2 && input[0].chargedHours<2.01);
  scheduler.plan(input.map(t=>({...t,hours:cents(t.hours-t.chargedHours)/100})),calendar(),today);
  assert.equal(JSON.stringify(context.ClientLiteStore.get()),before);assert.equal(writes,0);
});
test('deterministic varied workloads conserve hours and never return to a previous task', () => {
  let seed=71231;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let round=0;round<40;round++) {
    const input=Array.from({length:2+Math.floor(random()*7)},(_,i)=>task(String(i),Math.round((.01+random()*30)*100)/100,scheduler.dateString(scheduler.dateNumber(today)+Math.floor(random()*12)),{priority:['urgent','high','normal','low'][Math.floor(random()*4)],availableFrom:scheduler.dateString(scheduler.dateNumber(today)+Math.floor(random()*4))}));
    invariants(scheduler.plan(input,calendar({regular:2+Math.floor(random()*7),overtime:Math.floor(random()*4),excluded:['2026-10-15']}),today),input);
  }
});
