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
