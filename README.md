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
