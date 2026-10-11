/* Single-person, preemptible work planner. Integer hundredths of an hour avoid drift. */
(function (root) {
  "use strict";
  const DAY = 86400000;
  const ranks = { urgent: 0, high: 1, normal: 2, low: 3 };
  const dateNumber = (s) => Date.parse(`${s}T00:00:00Z`) / DAY;
  const dateString = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const units = (h) => Math.round(h * 100);
  const hours = (u) => u / 100;
  function plan(tasks, settings, today) {
    const start = settings.start > today ? settings.start : today;
    const first = dateNumber(start);
    const limit = Math.min(first + 729, dateNumber("9999-12-31"));
    const excluded = new Set(settings.excluded || []);
    const regular = units(settings.regular);
    const overtime = units(settings.overtime);
    const days = Array.from({ length: limit - first + 1 }, (_, i) => {
      const date = dateString(first + i);
      const working = settings.weekdays.includes(new Date((first + i) * DAY).getUTCDay()) && !excluded.has(date);
      return { date, working, regularCapacity: working ? regular : 0, overtimeCapacity: working ? overtime : 0, regular: 0, overtime: 0, allocations: [] };
    });
    const ordered = tasks.slice().sort((a, b) => a.due.localeCompare(b.due) || ranks[a.priority] - ranks[b.priority] || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    const results = ordered.map((task, index) => ({ ...task, order: index + 1, remaining: units(task.hours), allocations: [], start: null, finish: null, regularHours: 0, overtimeHours: 0, shortageHours: 0, unplannedHours: 0 }));
    function assign(task, d, amount, type) {
      if (!amount) return;
      task.remaining -= amount;
      d[type] += amount;
      let a = task.allocations.find((item) => item.date === d.date);
      if (!a) { a = { date: d.date, regular: 0, overtime: 0 }; task.allocations.push(a); }
      a[type] += amount;
      d.allocations.push({ id: task.id, name: task.name, type, hours: hours(amount) });
    }
    // Earliest deadlines first: consume normal capacity, then only the necessary extra
    // capacity before that deadline. Extra hours are placed as late as feasible.
    // Prefix deficits, not average workload, determine overtime requirements.
    let cumulative = 0;
    let required = 0;
    for (const task of results) {
      const deadline = Math.floor(dateNumber(task.due) - first);
      const end = Math.min(deadline, days.length - 1);
      if (deadline >= 0 && deadline < days.length) {
        cumulative += task.remaining;
        const capacity = days.slice(0, end + 1).reduce((sum, d) => sum + d.regularCapacity, 0);
        required = Math.max(required, cumulative - capacity);
        for (let i = 0; i <= end && task.remaining; i++) assign(task, days[i], Math.min(task.remaining, days[i].regularCapacity - days[i].regular), "regular");
        for (let i = end; i >= 0 && task.remaining; i--) assign(task, days[i], Math.min(task.remaining, days[i].overtimeCapacity - days[i].overtime), "overtime");
      }
      task.shortageHours = deadline < days.length ? hours(task.remaining) : 0;
    }
    // Never steal an on-time task's capacity to catch up an already missed deadline.
    // Late/beyond-window work uses spare normal hours, not pointless post-deadline OT.
    for (const task of results) {
      const deadline = Math.floor(dateNumber(task.due) - first);
      const from = deadline >= days.length ? 0 : Math.max(0, deadline + 1);
      for (let i = from; i < days.length && task.remaining; i++) assign(task, days[i], Math.min(task.remaining, days[i].regularCapacity - days[i].regular), "regular");
      task.allocations.sort((a, b) => a.date.localeCompare(b.date));
      task.start = task.allocations[0]?.date || null;
      task.finish = task.remaining ? null : task.allocations.at(-1)?.date || null;
      task.regularHours = hours(task.allocations.reduce((sum, a) => sum + a.regular, 0));
      task.overtimeHours = hours(task.allocations.reduce((sum, a) => sum + a.overtime, 0));
      task.unplannedHours = hours(task.remaining);
      task.status = deadline >= days.length ? "Beyond planning window" : task.due < today ? "Already overdue" : task.due < start ? "Before plan start" : task.shortageHours ? "Deadline at risk" : task.overtimeHours ? "On time with overtime" : "On time";
      task.allocations.forEach((a) => { a.regular = hours(a.regular); a.overtime = hours(a.overtime); });
      delete task.remaining;
    }
    const lastUsed = days.findLastIndex((d) => d.allocations.length);
    const lastDue = Math.max(0, ...tasks.map((t) => Math.min(days.length - 1, Math.max(0, dateNumber(t.due) - first))));
    const shown = days.slice(0, Math.min(days.length, Math.max(27, lastUsed, lastDue) + 1));
    shown.forEach((d) => { d.regular = hours(d.regular); d.overtime = hours(d.overtime); d.regularCapacity = hours(d.regularCapacity); d.overtimeCapacity = hours(d.overtimeCapacity); });
    return {
      start, windowEnd: dateString(limit), tasks: results, days: shown,
      requiredOvertime: hours(Math.max(0, required)),
      plannedOvertime: results.reduce((s, t) => s + t.overtimeHours, 0),
      lateCount: results.filter((t) => t.shortageHours > 0).length,
      beyondCount: results.filter((t) => t.status === "Beyond planning window").length,
      unplannedHours: results.reduce((s, t) => s + t.unplannedHours, 0)
    };
  }
  const api = { plan, dateNumber, dateString };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PaidproScheduler = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
