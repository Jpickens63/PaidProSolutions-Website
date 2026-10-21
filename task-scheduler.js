/* Single-person decision-matrix planner. Automatic tasks run to completion unless
   a manual task reaches its requested date. Integer hundredths of an hour keep
   daily allocations and totals consistent. */
(function (root) {
  "use strict";
  const DAY = 86400000;
  const weights = { urgent: 2, high: 1, normal: .5, low: 0 };
  const dateNumber = (s) => Date.parse(`${s}T00:00:00Z`) / DAY;
  const dateString = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const units = (h) => Math.round(h * 100);
  const hours = (u) => u / 100;
  function decision(remainingHours, workingDays, priority) {
    const daysLeft = Math.max(1, workingDays), priorityWeight = weights[priority] ?? .5;
    const burn = remainingHours / daysLeft;
    // Ported from the reference workbook's PickMostUrgent_NoDynamic matrix.
    return { daysLeft, priorityWeight, burn, score: 1000000 / daysLeft + priorityWeight * 1000 + burn * 10 };
  }
  function plan(tasks, settings, today) {
    const start = settings.start > today ? settings.start : today, first = dateNumber(start);
    const limit = Math.min(first + 729, dateNumber("9999-12-31"));
    const excluded = new Set(settings.excluded || []), regular = units(settings.regular), overtime = Math.min(units(settings.overtime), units(24) - regular);
    const calendar = Array.from({ length: limit - first + 1 }, (_, i) => {
      const date = dateString(first + i), working = settings.weekdays.includes(new Date((first + i) * DAY).getUTCDay()) && !excluded.has(date);
      return { date, working, regularCapacity: working ? regular : 0, overtimeCapacity: working ? overtime : 0 };
    });
    const prefix = [0];
    calendar.forEach(d => prefix.push(prefix.at(-1) + Number(d.working)));
    const inputs = tasks.filter(t => units(t.hours) > 0).map(t => ({
      ...t, active: Boolean(t.active), scheduleMode: t.scheduleMode === "manual" ? "manual" : "auto",
      dependsOn: typeof t.dependsOn === "string" && t.dependsOn ? t.dependsOn : null,
      dependencyComplete: Boolean(t.dependencyComplete),
      total: units(t.hours), deadline: Math.floor(dateNumber(t.due) - first),
      ready: t.active ? 0 : Math.max(0, Math.floor(dateNumber(t.availableFrom || t.start || start) - first))
    }));
    const tie = (a, b) => a.due.localeCompare(b.due) || (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id);
    const matrix = (task, day) => decision(hours(task.remaining), prefix[Math.max(day, Math.min(calendar.length, task.deadline + 1))] - prefix[day], task.priority);
    function build(extra) {
      const days = calendar.map(d => ({ ...d, regular: 0, overtime: 0, allocations: [] }));
      const work = inputs.map(t => ({ ...t, remaining: t.total, shortage: t.deadline < 0 ? t.total : 0, allocations: [], order: 0 }));
      const byId = new Map(work.map(t => [t.id, t]));
      const dependencyReady = task => !task.dependsOn || task.dependencyComplete || (byId.has(task.dependsOn) && byId.get(task.dependsOn).remaining === 0);
      const deadlines = new Map();
      work.forEach(t => { const due=deadlines.get(t.deadline)||[]; due.push(t); deadlines.set(t.deadline,due); });
      let current = null, order = 0;
      function pick(day) {
        let ready = work.filter(t => t.remaining && t.ready <= day && dependencyReady(t));
        const active = ready.find(t => t.active && !t.order);
        if (active) return active;
        const manual = ready.filter(t => t.scheduleMode === "manual").sort((a, b) => a.ready - b.ready || tie(a, b));
        if (manual.length) return manual[0];
        // Catch up already-overdue work when no unstarted live-deadline task is ready.
        const live = ready.filter(t => t.deadline >= day);
        if (live.length) ready = live;
        let best, bestScore=-Infinity;
        for(const task of ready){const score=matrix(task,day).score;if(score>bestScore||score===bestScore&&tie(task,best)<0){best=task;bestScore=score;}}
        return best;
      }
      function assign(task, day, amount, type) {
        task.remaining -= amount; day[type] += amount;
        let allocation = task.allocations.at(-1);
        if (!allocation || allocation.date !== day.date) { allocation = { date: day.date, regular: 0, overtime: 0 }; task.allocations.push(allocation); }
        allocation[type] += amount;
        day.allocations.push({ id: task.id, name: task.name, type, hours: hours(amount) });
      }
      days.forEach((day, index) => {
        if (day.working && current?.remaining && !current.active && current.scheduleMode === "auto" &&
            work.some(t => t.remaining && t.scheduleMode === "manual" && t.ready <= index && dependencyReady(t))) current = null;
        if (day.working) for (const type of ["regular", "overtime"]) {
          let capacity = type === "regular" ? regular : extra[index];
          while (capacity > 0) {
            if (!current?.remaining) current = pick(index);
            if (!current) break;
            if (!current.order) { current.order = ++order; current.decision = matrix(current, index); }
            const amount = Math.min(capacity, current.remaining);
            assign(current, day, amount, type); capacity -= amount;
          }
        }
        (deadlines.get(index)||[]).forEach(t => { t.shortage = t.remaining; });
      });
      work.filter(t => !t.order).sort((a, b) => Number(b.active) - Number(a.active) || matrix(b, 0).score - matrix(a, 0).score || tie(a, b)).forEach(t => { t.order = ++order; });
      return { tasks: work.sort((a, b) => a.order - b.order), days };
    }
    // A missed deadline can be blocked by earlier selected tasks. Add capacity to
    // that prefix, rebuild the chronological plan, and keep per-day limits intact.
    const deficit = (result, target) => {
      const beforeDue = t => t.total - t.allocations.filter(a => a.date <= target.due).reduce((sum, a) => sum + a.regular + a.overtime, 0);
      return target.scheduleMode === "manual" ? beforeDue(target) : result.tasks.filter(t => t.order <= target.order).reduce((sum, t) => sum + beforeDue(t), 0);
    };
    const missed = result => result.tasks.filter(t => t.deadline >= 0 && t.deadline < calendar.length && t.shortage).sort(tie);
    const zero = calendar.map(() => 0), normal = build(zero);
    function solve(maxExtra) {
      let extra = zero.slice(), result = normal;
      const blocked = new Set();
      for (let attempt = 0; attempt < 200; attempt++) {
        const target = missed(result).find(t => !blocked.has(t.id));
        if (!target) break;
        let need = deficit(result, target), changed = false;
        for (let i = target.deadline; i >= 0 && need; i--) {
          const add = calendar[i].working ? Math.min(need, maxExtra - extra[i]) : 0;
          if (add > 0) { extra[i] += add; need -= add; changed = true; }
        }
        if (!changed) blocked.add(target.id); else result = build(extra);
      }
      // Removing extra capacity can change matrix choices. Accept a reduction
      // only after checking every task's deadline shortage and unplanned hours.
      const protects = candidate => candidate.tasks.every(t => {
        const old = result.tasks.find(p => p.id === t.id);
        return t.shortage <= old.shortage && t.remaining <= old.remaining;
      });
      const used = result.days.map(d => d.overtime), trimmed = build(used);
      if (protects(trimmed)) { extra = used; result = trimmed; }
      for (let i = extra.length - 1; i >= 0; i--) if (extra[i]) {
        let low = 0, high = extra[i], best = result;
        const saved = extra[i];
        while (low < high) {
          const mid = Math.floor((low + high) / 2); extra[i] = mid;
          const candidate = build(extra);
          if (protects(candidate)) { high = mid; best = candidate; } else low = mid + 1;
        }
        extra[i] = low;
        if (low < saved) result = best;
      }
      return result;
    }
    const scheduled = overtime && missed(normal).length ? solve(overtime) : normal;
    const needed = missed(scheduled).length ? solve(Math.max(0, units(24) - regular)) : scheduled;
    const extraUsed = result => result.days.reduce((sum, d) => sum + d.overtime, 0);
    const unresolved = Math.max(0, ...missed(needed).map(t => deficit(needed, t)));
    const required = extraUsed(needed) + unresolved;
    const results = scheduled.tasks.map(task => {
      const { total, deadline, ready, remaining, shortage, ...result } = task;
      result.start = task.allocations[0]?.date || null;
      result.finish = remaining ? null : task.allocations.at(-1)?.date || null;
      result.regularHours = hours(task.allocations.reduce((sum, a) => sum + a.regular, 0));
      result.overtimeHours = hours(task.allocations.reduce((sum, a) => sum + a.overtime, 0));
      result.shortageHours = hours(shortage); result.unplannedHours = hours(remaining);
      const prerequisite = task.dependsOn && scheduled.tasks.find(t => t.id === task.dependsOn);
      const dependencyBlocked = remaining && task.dependsOn && !task.dependencyComplete && (!prerequisite || prerequisite.remaining);
      result.status = dependencyBlocked ? "Blocked by dependency" : deadline >= calendar.length ? "Beyond planning window" : task.due < today ? "Already overdue" : task.due < start ? "Before plan start" : shortage ? "Deadline at risk" : result.overtimeHours ? "On time with overtime" : "On time";
      result.allocations = task.allocations.map(a => ({ date: a.date, regular: hours(a.regular), overtime: hours(a.overtime) }));
      return result;
    });
    const lastUsed = scheduled.days.findLastIndex(d => d.allocations.length);
    const lastDue = Math.max(0, ...inputs.map(t => Math.min(calendar.length - 1, Math.max(0, t.deadline))));
    const shown = scheduled.days.slice(0, Math.min(calendar.length, Math.max(27, lastUsed, lastDue) + 1)).map(d => ({
      ...d, regular: hours(d.regular), overtime: hours(d.overtime), regularCapacity: hours(d.regularCapacity), overtimeCapacity: hours(d.overtimeCapacity)
    }));
    return { start, windowEnd: dateString(limit), tasks: results, days: shown,
      requiredOvertime: hours(required), plannedOvertime: hours(extraUsed(scheduled)), extraCapacityShortage: hours(unresolved),
      lateCount: results.filter(t => t.shortageHours > 0).length,
      blockedCount: results.filter(t => t.status === "Blocked by dependency").length,
      beyondCount: results.filter(t => t.status === "Beyond planning window").length,
      unplannedHours: hours(scheduled.tasks.reduce((sum, t) => sum + t.remaining, 0)) };
  }
  const api = { plan, decision, dateNumber, dateString };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PaidproScheduler = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
