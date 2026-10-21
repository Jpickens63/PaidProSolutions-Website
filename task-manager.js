(() => {
  "use strict";
  if (!window.ClientLiteStore) return;
  const sharedStore = window.ClientLiteStore;
  const priorities = { urgent: 0, high: 1, normal: 2, low: 3 };
  const priorityNames = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
  const byId = (id) => document.getElementById(id);
  const form = byId("task-form");
  const fields = { name: byId("task-name"), description: byId("task-description"), hours: byId("task-hours"), priority: byId("task-priority"), due: byId("task-due"), dependsOn: byId("task-dependency") };
  const rows = byId("task-rows");
  const dialog = byId("delete-dialog");
  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  let tasks = [];
  let editingId = null;
  let deletingId = null;
  let tasksRevision = 0, editingRevision = 0, deletingRevision = 0;
  let toastTimeout;
  let storageWritable = true;
  let day = today();
  const calendarKey = "paidpro-task-calendar-v1";
  const calendar = { start: byId("plan-start"), regular: byId("regular-hours"), overtime: byId("overtime-hours"), excluded: byId("days-off") };
  let schedule;
  let pageOffset = 0;
  let calendarWritable = true;
  let calendarReady = false;
  let lastPlanKey = null;
  calendar.start.value = day;
  function readCalendar(raw) {
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.version !== 1 || !validDate(s.start) || !Number.isFinite(s.regular) || s.regular < .01 || !Number.isFinite(s.overtime) || s.overtime < 0 || s.regular + s.overtime > 24 || !Array.isArray(s.weekdays) || !s.weekdays.length || s.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || !Array.isArray(s.excluded) || s.excluded.length > 100 || s.excluded.some((d) => !validDate(d))) throw new Error("Invalid work calendar");
    return s;
  }
  function setCalendar(s) {
    if (!s) return;
    ["start", "regular", "overtime"].forEach((key) => { calendar[key].value = s[key]; });
    calendar.excluded.value = s.excluded.join(", ");
    document.querySelectorAll(".working-days input").forEach((input) => { input.checked = s.weekdays.includes(Number(input.value)); });
  }
  try { setCalendar(readCalendar(localStorage.getItem(calendarKey))); }
  catch { calendarWritable = false; byId("calendar-error").textContent = "Saved calendar could not be read. Default settings are used for this session; existing settings have not been overwritten."; byId("calendar-error").hidden = false; }

  function calendarSettings() {
    const s = { version: 1, start: calendar.start.value, regular: Number(calendar.regular.value), overtime: Number(calendar.overtime.value), weekdays: [...document.querySelectorAll(".working-days input:checked")].map((input) => Number(input.value)), excluded: calendar.excluded.value.split(",").map((d) => d.trim()).filter(Boolean) };
    try { return readCalendar(JSON.stringify(s)); } catch { return null; }
  }
  function notifyCalendar(){
    if(window.parent!==window){const s=calendarSettings();window.parent.dispatchEvent(new window.parent.CustomEvent('paidpro-calendar-change',{detail:s?{...s,fallback:!calendarWritable}:null}));}
  }
  function formatDate(value) { return value ? dateFormat.format(new Date(`${value}T12:00:00`)) : "Not fully scheduled"; }
  function recalculate() {
    const settings = calendarSettings();
    if (!settings) {
      lastPlanKey = null;
      schedule = null;
      byId("calendar-error").textContent = "Use a valid start date, at least one working day, and total normal + extra hours of no more than 24 per day. Days off must be valid YYYY-MM-DD dates (up to 100).";
      byId("calendar-error").hidden = false;
      byId("plan-verdict").textContent = "Check your work calendar.";
      byId("plan-explanation").textContent = "A schedule and export are unavailable until these settings are valid.";
      byId("schedule-results").hidden = true;
      byId("export-excel").disabled = true;
      ["required-overtime", "planned-overtime", "late-tasks"].forEach((id) => { byId(id).textContent = "—"; });
      return;
    }
    if (calendarReady && calendarWritable) byId("calendar-error").hidden = true;
    const key = JSON.stringify([tasks, settings, today()]);
    if (key === lastPlanKey) return;
    lastPlanKey = key;
    const planningTasks = tasks.map(task => ({ ...task, estimatedHours: task.hours, hours: Math.max(0, Math.round((task.hours - (task.chargedHours || 0)) * 100) / 100) })).filter(task => task.hours > 0);
    schedule = PaidproScheduler.plan(planningTasks, settings, today());
    byId("export-excel").disabled = !planningTasks.length;
    byId("schedule-results").hidden = !planningTasks.length;
    byId("required-overtime").textContent = `${numberFormat.format(schedule.requiredOvertime)} hr${schedule.extraCapacityShortage?' gap':''}`;
    byId("planned-overtime").textContent = `${numberFormat.format(schedule.plannedOvertime)} hr`;
    byId("late-tasks").textContent = schedule.lateCount;
    byId("plan-outcome").className = `plan-outcome ${schedule.lateCount || schedule.beyondCount || schedule.unplannedHours ? "risk" : schedule.requiredOvertime ? "extra" : "fits"}`;
    byId("plan-verdict").textContent = !tasks.length ? "Add tasks to see your schedule." : schedule.blockedCount ? "Some tasks are waiting for a prerequisite." : schedule.lateCount ? "Not all deadlines can be met with this calendar." : schedule.beyondCount ? "Some deadlines are beyond the planning window." : schedule.requiredOvertime ? "Overtime is needed to meet these deadlines." : "Your tasks fit within normal working hours.";
    byId("plan-explanation").textContent = !tasks.length ? "Start with your normal workweek, then enter each task’s estimated hours and due date." : `The matrix plan estimates ${numberFormat.format(schedule.requiredOvertime)} extra hours to meet reachable deadlines; this plan uses ${numberFormat.format(schedule.plannedOvertime)} hr under your daily limit. ${schedule.blockedCount ? `${schedule.blockedCount} task(s) cannot start inside this plan because their prerequisite is not yet complete in the planning window. ` : ""}${schedule.lateCount ? `${schedule.lateCount} task(s) are overdue, before your plan start, or short of capacity by their deadline. ` : ""}${schedule.start !== settings.start ? `Plan starts today (${formatDate(schedule.start)}), not in the past. ` : ""}${schedule.beyondCount ? `${schedule.beyondCount} task(s) need a later planning window. ` : ""}${schedule.unplannedHours ? `${numberFormat.format(schedule.unplannedHours)} hr cannot fit in the two-year window.` : ""}`;
    if(schedule.extraCapacityShortage)byId('plan-explanation').textContent=`The matrix plan has a ${numberFormat.format(schedule.requiredOvertime)} hr capacity gap, including ${numberFormat.format(schedule.extraCapacityShortage)} hr that extra capacity cannot resolve in this plan. Review Scheduled Dates and deadlines. The configured plan uses ${numberFormat.format(schedule.plannedOvertime)} extra hr; ${schedule.lateCount} deadline(s) are missed or at risk.`;
    if (tasks.length && !planningTasks.length) {
      byId("plan-verdict").textContent = "All estimated hours have been recorded.";
      byId("plan-explanation").textContent = "Mark finished tasks complete in Time Card, or increase their estimates if work remains. Recorded time is never treated as a completion approval.";
    }
    byId("schedule-limit").textContent = `The planner looks ahead up to ${formatDate(schedule.windowEnd)}. Deadlines are inclusive (end of day). Days off and unchecked weekdays have no capacity. Hover or focus a day cell for its hours.`;
    pageOffset = Math.max(minimumPageOffset(), Math.min(pageOffset, Math.max(0, Math.ceil(schedule.days.length / 28) * 28 - 28)));
    renderSchedule();
  }
  function renderSchedule() {
    if (!schedule) return;
    const days = Array.from({ length: 28 }, (_, index) => scheduleDay(pageOffset + index)).filter(Boolean);
    byId("date-range").textContent = `${formatDate(days[0].date)} – ${formatDate(days.at(-1).date)}`;
    byId("previous-days").disabled = pageOffset <= minimumPageOffset();
    byId("next-days").disabled = pageOffset + 28 >= schedule.days.length;
    const head = document.createElement("tr");
    ["Task / scheduler order", "Start → finish", "Result"].forEach((label) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; head.append(th); });
    days.forEach((d) => { const th = document.createElement("th"); th.scope = "col"; th.className = `day-heading ${d.working ? "" : "off-day"} ${d.date === today() ? "current-day" : ""}`; th.textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${d.date}T12:00:00`)); const name = document.createElement("small"); name.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${d.date}T12:00:00`)); th.append(name);
      const available=document.createElement('small');available.className='calendar-available';available.textContent=`Available ${numberFormat.format(d.regularCapacity)} hr`;
      const assigned=document.createElement('small');assigned.className='calendar-assigned';assigned.textContent=`Assigned ${numberFormat.format(d.regular+d.overtime)} hr`;if(d.regular+d.overtime>d.regularCapacity+.0001)assigned.classList.add('over-capacity');th.append(available,assigned);head.append(th); });
    byId("schedule-head").replaceChildren(head);
    const body = document.createDocumentFragment();
    schedule.tasks.forEach((task) => {
      const tr = document.createElement("tr");
      const name = cell(`${task.taskNumber} · ${task.name}`, "Task", "schedule-name");
      name.title = `${task.description || task.name} · ${numberFormat.format(task.hours)} hr · ${priorityNames[task.priority]} · due ${formatDate(task.due)}`;
      if(task.decision)name.title+=` · Selected with ${task.decision.daysLeft} working day(s) left, ${numberFormat.format(task.decision.burn)} remaining hr/day, score ${numberFormat.format(task.decision.score)}${task.active?' · Running task kept first':''}`;
      const dates = cell(`${task.scheduleMode === "manual" ? "Manual" : "Auto"}: ${task.start ? formatDate(task.start) : "—"} → ${formatDate(task.finish)}`, "Dates", "schedule-dates");
      dates.title = task.scheduleMode === "manual" ? `Requested start ${formatDate(task.availableFrom)}` : "Start assigned by the Scheduler";
      const status = cell(task.status, "Result", task.shortageHours || task.unplannedHours ? "schedule-risk" : "schedule-status");
      tr.append(name, dates, status);
      const createdDate = timestampDate(task.createdAt);
      days.forEach((d) => {
        const a = task.allocations.find((item) => item.date === d.date);
        const td = cell(a ? numberFormat.format(a.regular + a.overtime) : "", d.date, `day-cell ${d.working ? "" : "off-day"} ${d.date === today() ? "current-day" : ""}`);
        const markers = [];
        if (d.date === createdDate) { td.classList.add("task-created-date"); markers.push(`created date ${formatDate(createdDate)}`); }
        if (d.date === task.due) { td.classList.add("task-complete-date"); markers.push(`complete-by date ${formatDate(task.due)}`); }
        if (a) { td.classList.add(d.date > task.due ? "late-work" : a.overtime ? "extra-work" : "normal-work"); td.title = `${task.name} · ${formatDate(d.date)}: ${numberFormat.format(a.regular)} normal + ${numberFormat.format(a.overtime)} overtime hr`; td.setAttribute("tabindex", "0"); td.setAttribute("aria-label", td.title); }
        if (markers.length) { td.title = `${task.name} · ${markers.join(" and ")}${a ? ` · ${td.title}` : ""}`; td.setAttribute("tabindex", "0"); td.setAttribute("aria-label", td.title); }
        tr.append(td);
      });
      body.append(tr);
    });
    byId("schedule-rows").replaceChildren(body);
    const foot = document.createDocumentFragment();
    [["Normal hours planned", "regular"], ["Normal hours available", "regularCapacity"], ["Overtime planned", "overtime"], ["Extra hours limit", "overtimeCapacity"]].forEach(([label, key]) => {
      const tr = document.createElement("tr"); const th = document.createElement("th"); th.scope = "row"; th.colSpan = 3; th.textContent = label; tr.append(th);
      days.forEach((d) => tr.append(cell(numberFormat.format(d[key]), label, `day-cell ${key === "overtime" && d[key] ? "extra-work" : ""}`))); foot.append(tr);
    });
    byId("schedule-totals").replaceChildren(foot);
  }

  function today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function timestampDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function shiftDate(value, offset) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function minimumPageOffset() {
    if (!schedule?.tasks.length) return 0;
    const earliest = Math.min(0, ...schedule.tasks.map((task) => dateNumber(timestampDate(task.createdAt)) - dateNumber(schedule.start)));
    return Math.floor(earliest / 28) * 28;
  }

  function dateNumber(value) {
    const [year, month, date] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, date) / 86400000;
  }

  function scheduleDay(offset) {
    if (offset >= schedule.days.length) return null;
    if (offset >= 0) return schedule.days[offset];
    return { date: shiftDate(schedule.start, offset), working: false, regularCapacity: 0, overtimeCapacity: 0, regular: 0, overtime: 0 };
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
    const [year, month, dayOfMonth] = value.split("-").map(Number);
    const date = new Date(year, month - 1, dayOfMonth);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === dayOfMonth;
  }

  function validTask(task) {
    return task && typeof task.id === "string" && task.id.length > 0 && task.id.length <= 80 &&
      typeof task.name === "string" && task.name.trim().length > 0 && task.name.length <= 150 &&
      typeof task.description === "string" && task.description.length <= 2000 &&
      typeof task.hours === "number" && Number.isFinite(task.hours) && task.hours >= 0.01 && task.hours <= 100000 &&
      Object.hasOwn(priorities, task.priority) && validDate(task.due) &&
      (task.dependsOn === null || typeof task.dependsOn === "string" && task.dependsOn !== task.id) &&
      Number.isFinite(task.createdAt) && task.createdAt >= 0;
  }

  function storageWarning(message) {
    const warning = byId("storage-warning");
    warning.textContent = message;
    warning.hidden = false;
    byId("save-state").textContent = "This session only";
    byId("save-state").parentElement.classList.add("unsaved");
  }

  function reloadTasks() {
    const snapshot = sharedStore.get();
    tasks = sharedStore.managerTasks(snapshot);
    tasksRevision = snapshot.revision;
  }
  reloadTasks();
  storageWritable = sharedStore.writable();
  if (sharedStore.warning()) storageWarning(sharedStore.warning());

  function persist(expectedRevision = tasksRevision) {
    try {
      const saved = sharedStore.saveManagerTasks(tasks, expectedRevision);
      storageWritable = saved;
      if (saved) byId("save-state").textContent = "Saved on this device";
      else storageWarning(sharedStore.warning());
      reloadTasks();
      return saved;
    } catch (error) {
      reloadTasks();
      announce(error.message);
      return null;
    }
  }

  function announce(message) {
    clearTimeout(toastTimeout);
    const toast = byId("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimeout = setTimeout(() => toast.classList.remove("visible"), 4500);
  }

  function cell(value, label, className = "") {
    const element = document.createElement("td");
    element.textContent = value;
    element.dataset.label = label;
    element.className = className;
    return element;
  }

  function actionButton(action, task) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-button ${action}`;
    button.dataset.action = action;
    button.dataset.id = task.id;
    button.setAttribute("aria-label", `${action === "edit" ? "Edit" : "Delete"} ${task.taskNumber} ${task.name}`);
    button.title = action === "edit" ? "Edit task" : "Delete task";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", action === "edit" ? "m15 4 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-3-3L6 16l-2 4Z" : "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7");
    svg.append(path);
    button.append(svg);
    return button;
  }

  function render() {
    day = today();
    const query = byId("search-tasks").value.trim().toLocaleLowerCase();
    const sort = byId("sort-tasks").value;
    recalculate();
    const visible = tasks.filter((task) => `${task.taskNumber} ${task.name} ${task.description}`.toLocaleLowerCase().includes(query));
    visible.sort((a, b) => {
      if (sort === "schedule" && schedule) return (schedule.tasks.find((t) => t.id === a.id)?.order || Number.MAX_SAFE_INTEGER) - (schedule.tasks.find((t) => t.id === b.id)?.order || Number.MAX_SAFE_INTEGER);
      if (sort === "priority") return priorities[a.priority] - priorities[b.priority] || a.due.localeCompare(b.due) || a.createdAt - b.createdAt;
      if (sort === "newest") return b.createdAt - a.createdAt;
      if (sort === "name") return a.name.localeCompare(b.name) || a.due.localeCompare(b.due);
      return a.due.localeCompare(b.due) || priorities[a.priority] - priorities[b.priority] || a.createdAt - b.createdAt;
    });
    const fragment = document.createDocumentFragment();
    visible.forEach((task) => {
      const row = document.createElement("tr");
      row.dataset.id = task.id;
      if (task.id === editingId) row.classList.add("editing");
      const taskCode=cell(task.taskNumber, "Task #", "task-code");
      const taskName=cell(task.name, "Task", "task-name");
      const scheduleLabel=document.createElement("small");scheduleLabel.className=`task-schedule-mode ${task.scheduleMode}`;scheduleLabel.textContent=task.scheduleMode==="manual"?"Manual schedule":"Auto schedule";taskName.append(scheduleLabel);
      if(task.dependencyName){const dependencyLabel=document.createElement("small");dependencyLabel.className="task-dependency";dependencyLabel.textContent=`After: ${task.dependencyNumber} · ${task.dependencyName}`;taskName.append(dependencyLabel);}
      row.append(taskCode, taskName, cell(task.description || "—", "Task description", "description"), cell(`${numberFormat.format(task.hours)} hr`, "Estimated time", "hours"));
      const priority = cell("", "Priority");
      const badge = document.createElement("span");
      badge.className = `priority ${task.priority}`;
      badge.textContent = priorityNames[task.priority];
      priority.append(badge);
      row.append(priority);
      const [year, month, date] = task.due.split("-").map(Number);
      const due = cell(dateFormat.format(new Date(year, month - 1, date)), "Due date", "due");
      const dueLabel = document.createElement("span");
      if (task.due < day) {
        due.classList.add("overdue");
        dueLabel.textContent = "Overdue";
      } else if (task.due === day) {
        due.classList.add("today");
        dueLabel.textContent = "Due today";
      } else {
        dueLabel.textContent = "Upcoming";
      }
      due.append(dueLabel);
      row.append(due);
      const actions = cell("", "Actions", "actions");
      const group = document.createElement("div");
      group.className = "row-actions";
      group.append(actionButton("edit", task), actionButton("delete", task));
      actions.append(group);
      row.append(actions);
      fragment.append(row);
    });
    rows.replaceChildren(fragment);
    byId("task-table").hidden = visible.length === 0;
    byId("empty-state").hidden = visible.length > 0;
    byId("empty-heading").textContent = tasks.length ? "No matching tasks." : "Your next task starts here.";
    byId("empty-copy").textContent = tasks.length ? "Try a different task name or description." : "Add a task on the left. A little clarity goes a long way.";
    byId("clear-search").hidden = !query;
    byId("task-count").textContent = tasks.length;
    byId("total-hours").replaceChildren(document.createTextNode(`${numberFormat.format(tasks.reduce((total, task) => total + task.hours, 0))} `));
    const hoursUnit = document.createElement("small");
    hoursUnit.textContent = "hr";
    byId("total-hours").append(hoursUnit);
    byId("due-today").textContent = tasks.filter((task) => task.due === day).length;
    byId("overdue-count").textContent = tasks.filter((task) => task.due < day).length;
    byId("list-count").textContent = query ? `${visible.length} of ${tasks.length} tasks` : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  }

  function formError(message) {
    byId("form-error").textContent = message;
    byId("form-error").hidden = !message;
  }

  function wouldCreateCycle(candidate, id) {
    if (!candidate || !id) return false;
    const byTask = new Map(tasks.map(task => [task.id, task]));
    let current = byTask.get(candidate); const seen = new Set();
    while (current && !seen.has(current.id)) {
      if (current.id === id) return true;
      seen.add(current.id); current = current.dependsOn ? byTask.get(current.dependsOn) : null;
    }
    return false;
  }

  function dependencyOptions(selected = "", selectedName = "") {
    fields.dependsOn.replaceChildren(new Option("No dependency", ""));
    tasks.filter(task => task.id !== editingId && !wouldCreateCycle(task.id, editingId)).sort((a,b) => a.taskNumber.localeCompare(b.taskNumber)).forEach(task => fields.dependsOn.append(new Option(`${task.taskNumber} · ${task.name}`, task.id)));
    if (selected && ![...fields.dependsOn.options].some(option => option.value === selected)) fields.dependsOn.append(new Option(`${selectedName || "Completed prerequisite"} (complete)`, selected));
    fields.dependsOn.value = selected;
  }

  function resetEditor() {
    editingId = null;
    form.reset();
    formError("");
    byId("form-heading").textContent = "Add a task";
    byId("form-caption").textContent = "Make room for your next piece of work.";
    byId("save-label").textContent = "Add task";
    byId("cancel-edit").hidden = true;
    byId("task-number").textContent = sharedStore.nextTaskNumber(sharedStore.get());
    dependencyOptions();
  }

  function editTask(task) {
    editingId = task.id;
    editingRevision = tasksRevision;
    byId("task-number").textContent = task.taskNumber;
    Object.entries(fields).forEach(([key, field]) => { field.value = task[key]; });
    dependencyOptions(task.dependsOn || "", task.dependencyName);
    formError("");
    byId("form-heading").textContent = "Edit task";
    byId("form-caption").textContent = "Update the details. Keep the work clear.";
    byId("save-label").textContent = "Save changes";
    byId("cancel-edit").hidden = false;
    render();
    fields.name.focus();
    byId("form-heading").scrollIntoView({ block: "nearest", behavior: "auto" });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    formError("");
    const task = {
      id: editingId || crypto.randomUUID(),
      taskNumber: editingId ? tasks.find((item) => item.id === editingId)?.taskNumber : byId("task-number").textContent,
      name: fields.name.value.trim(),
      description: fields.description.value.trim(),
      hours: Number(fields.hours.value),
      priority: fields.priority.value,
      due: fields.due.value,
      dependsOn: fields.dependsOn.value || null,
      createdAt: editingId ? tasks.find((item) => item.id === editingId)?.createdAt : Date.now()
    };
    if (!validTask(task) || wouldCreateCycle(task.dependsOn, task.id)) {
      formError("Enter a task name, an estimated time of at least 0.01 hours, a valid due date, and a prerequisite that does not create a loop.");
      return;
    }
    if (!editingId && tasks.length >= 500) {
      formError("This browser demo holds up to 500 tasks. Remove a task before adding another.");
      return;
    }
    const wasEditing = Boolean(editingId);
    if (wasEditing) tasks = tasks.map((item) => item.id === editingId ? task : item);
    else tasks.push(task);
    const saved = persist(wasEditing ? editingRevision : tasksRevision);
    if (saved === null) {
      formError("Workspace changed or the update could not be saved. Cancel and reopen the task to review its latest details, or retry adding your task.");
      render();
      return;
    }
    resetEditor();
    byId("search-tasks").value = "";
    render();
    announce(`${wasEditing ? "Task updated" : "Task added"}${saved ? "." : " for this session only."}`);
    fields.name.focus();
  });

  rows.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const task = tasks.find((item) => item.id === button.dataset.id);
    if (!task) return;
    if (button.dataset.action === "edit") editTask(task);
    else {
      deletingId = task.id;
      deletingRevision = tasksRevision;
      byId("delete-copy").textContent = task.name;
      dialog.showModal();
    }
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "delete" && deletingId) {
      const active = sharedStore.get().active;
      if (active?.category === "TASK" && active.task === deletingId) {
        announce("Stop the Time Card timer before removing its task.");
        deletingId = null; dialog.returnValue = ""; return;
      }
      tasks = tasks.filter((task) => task.id !== deletingId);
      const saved = persist(deletingRevision);
      render();
      if (saved !== null) {
        if (editingId === deletingId) resetEditor();
        announce(`Task removed; recorded time remains saved${saved ? "." : " for this session only."}`);
      }
      fields.name.focus();
    }
    deletingId = null;
    dialog.returnValue = "";
  });
  byId("cancel-edit").addEventListener("click", () => { resetEditor(); render(); fields.name.focus(); });
  byId("search-tasks").addEventListener("input", render);
  byId("sort-tasks").addEventListener("change", render);
  byId("clear-search").addEventListener("click", () => { byId("search-tasks").value = ""; render(); byId("search-tasks").focus(); });
  byId("calendar-form").addEventListener("submit", (event) => event.preventDefault());
  byId("calendar-form").addEventListener("change", () => {
    calendarReady = true; pageOffset = 0;
    const s = calendarSettings();
    if (s && calendarWritable) {
      try { localStorage.setItem(calendarKey, JSON.stringify(s)); }
      catch { calendarWritable = false; byId("calendar-error").textContent = "Calendar changes are kept only for this session because browser storage is unavailable."; byId("calendar-error").hidden = false; }
    }
    notifyCalendar();
    render();
  });
  byId("previous-days").addEventListener("click", () => { pageOffset = Math.max(minimumPageOffset(), pageOffset - 28); renderSchedule(); });
  byId("next-days").addEventListener("click", () => { pageOffset += 28; renderSchedule(); });
  byId("export-excel").addEventListener("click", async () => {
    if (!schedule || !tasks.length) return;
    const button = byId("export-excel"); button.disabled = true; button.textContent = "Preparing Excel…";
    try { await PaidproExport.download(schedule, calendarSettings()); announce("Excel Gantt exported. Your browser task list is unchanged."); }
    catch { announce("Excel export could not be prepared. Please retry; your tasks are unchanged."); }
    finally { button.disabled = !schedule || !schedule.tasks.length; button.textContent = "Export Excel Gantt ↓"; }
  });
  window.addEventListener("storage", (event) => {
    if ((event.key === calendarKey || event.key === null) && calendarWritable) {
      try { setCalendar(readCalendar(event.key === null ? null : event.newValue) || { start: today(), regular: 8, overtime: 2, weekdays: [1,2,3,4,5], excluded: [] }); render(); }
      catch { calendarWritable = false; byId("calendar-error").textContent = "Calendar saved by another tab could not be read. Existing saved settings have not been overwritten."; byId("calendar-error").hidden = false; }
    }
    if(event.key===calendarKey||event.key===null)notifyCalendar();
  });
  sharedStore.subscribe(() => {
    reloadTasks();
    if (sharedStore.warning()) storageWarning(sharedStore.warning());
    if (editingId && !tasks.some(task => task.id === editingId)) resetEditor();
    if (!editingId) dependencyOptions();
    render();
  });
  window.addEventListener("focus", () => { if (day !== today()) render(); });
  setInterval(() => { if (day !== today() || sharedStore.get().active) { reloadTasks(); render(); } }, 60000);
  resetEditor();notifyCalendar();render();
})();
