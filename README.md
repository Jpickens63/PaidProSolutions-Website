# PAIDPRO Solutions Website

Updated static website for PaidProSolutions.com.

Files:
- index.html
- styles.css
- script.js
- images/paidpro-icon.png

Cloudflare Pages:
- Framework preset: None
- Build command: leave blank
- Build output directory: .
- Production branch: main

Wording note:
The site is intentionally framed around mechanical design support, CAD automation,
manufacturing workflows, and software development. It avoids presenting PAIDPRO Solutions
as a licensed professional engineering firm or advertising professional engineering services.

This is a wording/risk-reduction measure, not legal advice.


## Browser tab logo update
This version adds your PAIDPRO logo as the browser tab icon (favicon).

Added files:
- favicon.png
- apple-touch-icon.png

Added tags in the HTML head:
- <link rel="icon" type="image/png" href="favicon.png" />
- <link rel="apple-touch-icon" href="apple-touch-icon.png" />

After you upload/push these files, Cloudflare Pages should redeploy automatically.
If the old icon still appears, do a hard refresh or open the site in a new tab because browsers cache favicons.

## September 2026 industrial redesign

The site now follows the owner's metallic-blue PAIDPRO launch artwork: deep navy,
silver-and-blue branding, a CAD/workshop hero, and five icon-led service areas.
The original logo and module icons are preserved; optimized WebP website assets
are in `images/`. See `DESIGN_NOTES.md` for image provenance and final prompts.

This is still a framework-free static site with no build step or external script/font dependencies.
The Client Vault link remains `https://portal.paidprosolutions.com` and contact
links remain `mailto:contact@paidprosolutions.com`. The PAIDPRO platform is
explicitly described as in development.

Preview locally with any static HTTP server from the repository root, for example:

```powershell
py -3.13 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. Source edits are not published automatically;
a push to the Cloudflare Pages production branch is a separate deployment action.

Validation covers 320px–1920px layouts, image and anchor loading, mobile menu
and keyboard behavior, reduced motion, and content/navigation without JavaScript.

## PAIDPRO CLIENT LITE browser workspace

- `lite-demo.html`: the single PAIDPRO CLIENT LITE shell. Work contains Time Card
  and a scheduled Project Gantt. The Reports tab has been removed.
  The header displays the running Client Lite major/minor release and preview
  number so a deployed browser build can be identified without opening developer
  tools. `client-lite-version.json` is the source of truth. The website begins
  tracked release history at `0.1.0-preview.4`; the current website release is
  `0.1.0-preview.6`. The verified Windows and Linux installer baseline immediately
  before it is `0.1.0-preview.3`. Website release commits use scoped Git tags such
  as `client-lite-v0.1.0-preview.6`.
  This browser example uses localStorage, not SQLite.
  Project Gantt shows daily Available and Assigned hours above the dates. Capacity
  defaults to 8 hours Monday-Friday and shares the Task-Manager work calendar.
  Project Gantt, Task-Manager and Excel export use one plan from
  `task-scheduler.js`. New tasks default to Auto Schedule. The Scheduler derives
  their dates from capacity, deadlines, priority, manual work and prerequisites.
  Every task also receives a permanent `TASK-001` style display number that is
  shared across Time Card, Task-Manager, Gantt views, dependencies and exports.
  Switching a task to Manual Schedule enables its date field and gives it
  priority on the requested working date. Auto work recalculates around it. A
  running Time Card task stays first. A task can select one prerequisite. The
  forecast schedules that prerequisite first, while Time Card prevents the
  dependent task from starting until the prerequisite is marked complete.
  Circular dependencies are rejected.
  Bars show actual planned hours, rounded in hundredths; empty days have no bar.
  Each task row has a green leading line on its task-created date and a
  red trailing line at the end of its Complete By date. Task-Manager uses the
  same date markers in its Gantt view. Backward paging remains available through
  the earliest task-created date so markers for older tasks can still be viewed.
  The Work task menu includes Delete Task with a confirmation prompt. A running
  task must be stopped first. Tasks without clocking or Work Ticket history are
  permanently deleted; tasks with history are removed from Client Lite views and
  archived so their historical labels remain available.
  Amber includes extra hours and rose flags work after its deadline. Paging covers
  the full plan. Non-working days have zero capacity.
  Time Card includes the effective Scheduled Date and sorts ascending by that
  date, with priority/due-date ties resolved consistently. Auto and Manual badges
  identify where the date came from, and Depends On shows the prerequisite. In
  task properties, Auto Schedule grays out Scheduled Date; Manual Schedule
  enables it. Non-chargeable categories show no scheduled date.
  Removing the Reports interface does not delete clockings, archived tasks,
  existing Work Tickets or running timers. Historical data stays in the same
  workspace format. Old `#reports` bookmarks fall back to Work/Time Card.
  Browser printing now prints the Time Card, including its Scheduled Date column.
- `task-manager.html`: the internal Task-Manager module, embedded under the shared
  Client Lite header/navigation. The old standalone URL redirects to
  `lite-demo.html#task-manager`. It has Task, Task Description, Estimated Time
  (decimal hours), Priority and Due Date, plus add/edit/remove/search/sort.
  Tasks are shared with Work through `lite-store.js`, not copied between
  independent apps. The canonical workspace is `paidpro-client-lite-v2`.
  First use imports `paidpro-lite-example-v1` tasks, clockings and tickets and
  `paidpro-task-manager-v1` tasks. Both old keys remain untouched. New Task-Manager
  tasks default to PERSONAL / General; edit their affiliations in Work. Removing
  a task archives it so its clocking/ticket history keeps its labels. A running
  task cannot be removed. Completing a task in Work removes it from the planner.
  Its single-person planner ports the decision matrix in the reference workbook's
  `PickMostUrgent_NoDynamic` VBA function: score = 1,000,000 / working days left
  + priority weight * 1,000 + remaining hours / working days left * 10.
  Urgent/High/Normal/Low map to the workbook's weights 2/1/0.5/0. Working days left
  has a minimum of one. Score is evaluated when choosing the next available Auto
  task. Auto work normally remains selected until finished, but a ready Manual
  task takes priority at the start of its requested working day. A dependent task
  is not eligible until its prerequisite finishes in the projection. An active
  Time Card task goes first. Normal capacity is used before extra hours. Visitors
  configure plan start, normal hours, a daily extra-hours limit, working weekdays
  and days off (`paidpro-task-calendar-v1`). Tasks may split across working days.
  The plan uses total estimates minus recorded task time. Manual Scheduled Date
  is requested availability; an Auto date is derived. A manual date on a
  non-working day begins on the next day with capacity. Competing manual tasks
  remain sequential and a later one can slip when capacity is exhausted.
  Consuming an estimate
  does not automatically complete a task or alter its saved dates/clockings.
  Extra capacity is added before missed deadlines, rebuilding the same sequential
  plan within the configured limit, then reduced only when no task's deadline
  shortage or unplanned hours worsen. The estimate is specific to this decision
  policy and is not a mathematically global minimum. Date constraints can remain
  infeasible even with extra hours. The adjustment search is bounded at 200 passes.
  Past deadlines are flagged and never backdated. A rolling two-year horizon is
  explicit; shortages and beyond-window work are not reported as on time.
  The schedule recomputes on task/calendar changes and at a date rollover while
  the page is open. It is not a background company scheduler or overtime approval.
  Excel export uses an artifact-tool-authored clean style template, with task
  details on the left, weekly/date headers, colored daily hours, normal/extra
  capacity totals, frozen labels and formulas for totals. Visitor data is filled
  locally into a standard `.xlsx` ZIP; no external library/CDN or upload is used.
  The original reference workbook and its private contents are not published.
  Exported dates are a snapshot, not an Excel-based rescheduler.

Run the scheduler regressions with `node --test tests/scheduler.test.cjs`.

The single Client Lite entry is linked from Time Management (`/#time-management`),
accessible through the top menu or footer. The app links back to that section.
This example does not connect to
the company server, send visitor tasks to PAIDPRO, or require sign-in. Data is
specific to the browser/device and may be lost if browser storage is cleared.
Storage/migration failures are surfaced instead of overwriting unreadable saved
data or claiming a save. Modules still share their session-only state when storage
is blocked. Cross-tab updates use the same shared workspace; stale edits are
rejected with a retry warning instead of overwriting newer saved changes.
The demo is not a substitute for backed-up business records.
