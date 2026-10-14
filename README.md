# DeskMux showcase

The public presentation of [DeskMux](https://github.com/dion-labs/deskmux),
independent of the native application's release and deployment lifecycle.

`npm ci` then `npm run dev`. `npm run build` emits static HTML and assets to
`dist`. Cloudflare Pages uses `main`, `npm run build`, and output `dist`.
Production: https://deskmux.dionlabs.ai. Project: `deskmux-site`.

Every push to `main` builds automatically through the GitHub-connected Pages
project at `deskmux-site-7l8.pages.dev`. The `deskmux-domain` Worker is a small
custom-domain proxy to that origin; it has no application state or copied assets.
Only router changes need `wrangler deploy --config wrangler.router.jsonc`.

The interactive desk is an illustrative preview. It never accesses devices or
connects to DeskMux. Update compatibility claims and release download links
alongside application releases. Mux is original artwork created for Dion Labs.

The 1200×630 Open Graph / X card is a typeset HTML composition using the
existing Mux artwork. Edit `scripts/social-card.html`, then run
`node scripts/build-social-card.mjs` with Chrome installed to regenerate
`public/social-preview-v2.png`. Keep both image metadata sets in sync.

## Missing pages

`public/404.html` is copied to the output root during the build. Cloudflare
Pages uses it to return HTTP 404 for unknown paths instead of falling back to
the homepage. Keep this file when changing the build or hosting configuration.

## Local validation

Run `npm ci`, then `npm run build && npm run check` with Chrome installed.
The check serves built files on an ephemeral loopback port, blocks external
requests, and covers four viewport widths, keyboard/mouse demo behavior,
unavailable JavaScript, reduced motion, metadata/download consistency,
missing-page recovery and the edge proxy. Screenshots and results are written
to ignored `test-results/`.

See [the QA cases](docs/QA_CASES.md) for coverage and manual acceptance checks.
Browser tests do not contact devices or prove native hardware behavior. Google
Fonts is an existing external stylesheet dependency; tests block it and exercise
fallback fonts.

For cross-engine QA, install the matching test engines with
`npx playwright install firefox webkit`, then run `npm run check:engines`.
This tests Chrome plus Playwright Firefox and WebKit, not physical Safari or
mobile browsers. The 200% text case doubles computed font sizes to check reflow
independently of viewport or browser zoom.

Run `npm run check:hygiene` for icon decoding, footer keyboard order, contrast,
and four-width 100%/200% text reflow checks in all three engines.
For a version/copy-only update, `HYGIENE_SCOPE=release npm run check:hygiene`
checks the narrowest 320px layout at both text scales.

`npm run check:links` performs read-only HEAD requests to public destinations.
It sends no credentials and downloads no response bodies.

For a release update, save an actual `gh release view` JSON receipt with
`tagName,publishedAt,isDraft,url,assets` fields, rebuild, then run
`npm run check:release -- RECEIPT.json`. Add `--online` to fetch and hash the
published ZIP against its checksum. This does not install or execute the app.
The validator rejects drafts, incomplete assets and stale source/build links.
Run `npm test` for offline publication/error fixtures.
