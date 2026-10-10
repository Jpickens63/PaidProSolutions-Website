(() => {
  "use strict";
  const storageKey = "paidpro-task-manager-v1";
  const priorities = { urgent: 0, high: 1, normal: 2, low: 3 };
  const priorityNames = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
  const byId = (id) => document.getElementById(id);
  const form = byId("task-form");
  const fields = { name: byId("task-name"), description: byId("task-description"), hours: byId("task-hours"), priority: byId("task-priority"), due: byId("task-due") };
  const rows = byId("task-rows");
  const dialog = byId("delete-dialog");
  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  let tasks = [];
  let editingId = null;
  let deletingId = null;
  let toastTimeout;
  let storageWritable = true;
  let day = today();

  function today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
      Number.isFinite(task.createdAt) && task.createdAt >= 0;
  }

  function readTasks(raw) {
    if (raw === null) return [];
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || !Array.isArray(saved.tasks) || saved.tasks.length > 500 ||
        !saved.tasks.every(validTask) || new Set(saved.tasks.map((task) => task.id)).size !== saved.tasks.length) {
      throw new Error("Invalid saved demo data");
    }
    return saved.tasks.map(({ id, name, description, hours, priority, due, createdAt }) => ({ id, name, description, hours, priority, due, createdAt }));
  }

  function storageWarning(message) {
    const warning = byId("storage-warning");
    warning.textContent = message;
    warning.hidden = false;
    byId("save-state").textContent = "This session only";
    byId("save-state").parentElement.classList.add("unsaved");
  }

  try {
    tasks = readTasks(localStorage.getItem(storageKey));
  } catch {
    storageWritable = false;
    storageWarning("Saved tasks could not be loaded, or browser storage is blocked. Existing saved data has not been overwritten. New changes are kept only for this session.");
  }

  function persist() {
    if (!storageWritable) return false;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, tasks }));
      byId("save-state").textContent = "Saved on this device";
      return true;
    } catch {
      storageWritable = false;
      storageWarning("Your browser could not save these changes. They are kept only for this session and will be lost when you reload or close the page.");
      return false;
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
    button.setAttribute("aria-label", `${action === "edit" ? "Edit" : "Delete"} ${task.name}`);
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
    const visible = tasks.filter((task) => `${task.name} ${task.description}`.toLocaleLowerCase().includes(query));
    visible.sort((a, b) => {
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
      row.append(cell(task.name, "Task", "task-name"), cell(task.description || "—", "Task description", "description"), cell(`${numberFormat.format(task.hours)} hr`, "Estimated time", "hours"));
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

  function resetEditor() {
    editingId = null;
    form.reset();
    formError("");
    byId("form-heading").textContent = "Add a task";
    byId("form-caption").textContent = "Make room for your next piece of work.";
    byId("save-label").textContent = "Add task";
    byId("cancel-edit").hidden = true;
  }

  function editTask(task) {
    editingId = task.id;
    Object.entries(fields).forEach(([key, field]) => { field.value = task[key]; });
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
      name: fields.name.value.trim(),
      description: fields.description.value.trim(),
      hours: Number(fields.hours.value),
      priority: fields.priority.value,
      due: fields.due.value,
      createdAt: editingId ? tasks.find((item) => item.id === editingId)?.createdAt : Date.now()
    };
    if (!validTask(task)) {
      formError("Enter a task name, an estimated time of at least 0.01 hours, and a valid due date.");
      return;
    }
    if (!editingId && tasks.length >= 500) {
      formError("This browser demo holds up to 500 tasks. Remove a task before adding another.");
      return;
    }
    const wasEditing = Boolean(editingId);
    if (wasEditing) tasks = tasks.map((item) => item.id === editingId ? task : item);
    else tasks.push(task);
    const saved = persist();
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
      byId("delete-copy").textContent = task.name;
      dialog.showModal();
    }
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "delete" && deletingId) {
      tasks = tasks.filter((task) => task.id !== deletingId);
      if (editingId === deletingId) resetEditor();
      const saved = persist();
      render();
      announce(`Task deleted${saved ? "." : " for this session only."}`);
      fields.name.focus();
    }
    deletingId = null;
    dialog.returnValue = "";
  });
  byId("cancel-edit").addEventListener("click", () => { resetEditor(); render(); fields.name.focus(); });
  byId("search-tasks").addEventListener("input", render);
  byId("sort-tasks").addEventListener("change", render);
  byId("clear-search").addEventListener("click", () => { byId("search-tasks").value = ""; render(); byId("search-tasks").focus(); });
  window.addEventListener("storage", (event) => {
    if ((event.key === storageKey || event.key === null) && storageWritable) {
      try {
        tasks = readTasks(event.key === null ? null : event.newValue);
        if (editingId && !tasks.some((task) => task.id === editingId)) resetEditor();
        render();
        announce("Task list updated from another tab.");
      } catch {
        storageWritable = false;
        storageWarning("Another tab saved data this demo could not read. Changes here are now kept only for this session; the saved data has not been overwritten.");
      }
    }
  });
  window.addEventListener("focus", () => { if (day !== today()) render(); });
  setInterval(() => { if (day !== today()) render(); }, 60000);
  render();
})();
