# PAIDPRO Client LITE release history

## 0.1.0-preview.6

- Every task receives a permanent serialized display number such as `TASK-001`.
  Internal UUIDs remain unchanged for time entries and dependencies.
- Time Card, Task-Manager, both Gantt views, dependency selectors, and Excel
  exports show the same task number.
- The starter workspace now demonstrates a professional Client Portal Rollout
  with clear project, milestone, task, and description names.
- Obvious throwaway demo records such as TEST1 / task1 / task desc are refreshed
  to the improved starter workspace when they have no recorded time history.

## 0.1.0-preview.5

- New tasks default to Auto Schedule. The Scheduler assigns their scheduled
  dates and recalculates them when work, capacity, or manual dates change.
- Switching a task to Manual Schedule enables Scheduled Date and gives that
  task priority on its requested working date. Auto work moves around it.
- A task can depend on one prerequisite task. The projected schedule places the
  prerequisite first, and Time Card blocks starting the dependent task until
  the prerequisite is actually marked complete.
- Dependency loops are prevented, and a prerequisite with open dependents
  cannot be deleted.

## 0.1.0-preview.4

This is the first website release backed by an explicit version manifest,
consistency test, changelog, and Git tag.

- The green Gantt marker shows the task-created date.
- The red Gantt marker shows the Complete By date.
- Backward Gantt paging reaches older task-created dates.
- Client LITE Work provides confirmed task deletion while preserving recorded
  clocking and Work Ticket history.
- The Client LITE header displays the running release.

## Existing baseline: 0.1.0-preview.3

The PAIDPRO Client Lite Windows and Linux installer manifests both record
`0.1.0-preview.3`. The website repository had no product release tags or release
manifest at that point, so no website commit is retroactively assigned to it.
