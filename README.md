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
  and manually dated Project Gantt; Reports contains weekly hours and Work Tickets.
  This browser example uses localStorage, not SQLite.
- `task-manager.html`: the internal Task-Manager module, embedded under the shared
  Client Lite header/navigation. The old standalone URL redirects to
  `lite-demo.html#task-manager`. It has Task, Task Description, Estimated Time
  (decimal hours), Priority and Due Date, plus add/edit/remove/search/sort.
  Tasks are shared with Work/Reports through `lite-store.js`, not copied between
  independent apps. The canonical workspace is `paidpro-client-lite-v2`.
  First use imports `paidpro-lite-example-v1` tasks, clockings and tickets and
  `paidpro-task-manager-v1` tasks. Both old keys remain untouched. New Task-Manager
  tasks default to PERSONAL / General; edit their affiliations in Work. Removing
  a task archives it so its clocking/ticket history keeps its labels. A running
  task cannot be removed. Completing a task in Work removes it from the planner.
  Its single-person planner uses earliest due dates first, with priority as a tie
  breaker. Normal capacity is used before minimum necessary overtime. Visitors
  configure plan start, normal hours, a daily extra-hours limit, working weekdays
  and days off (`paidpro-task-calendar-v1`). Tasks may split across working days.
  The plan uses total estimates minus recorded task time; there are no dependencies
  or release dates. Consuming an estimate does not automatically complete a task.
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
