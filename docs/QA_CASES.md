# DeskMux showcase QA registry

Scope: the public website and its illustrative demo. Synthetic browser contexts
only; no native app, pairing, device or clipboard access. DS IDs remain stable
across releases.
Risk: P0 misleading download/privacy claims; P1 unusable navigation/demo; P2 polish.

| ID | Risk / scenario | Expected outcome | Mapping |
| --- | --- | --- | --- |
| DS-001 | P1 build / happy | Locked toolchain emits homepage, assets and 404 | `npm run build` |
| DS-002 | P1 responsive / platform | 1440/768/390/320 widths have decoded images, no overflow, failed local resources or JS errors | `npm run check` |
| DS-003 | P1 demo / happy | Both buttons switch status, class, input label and exactly one pressed state; repeat activation stays coherent | `npm run check` |
| DS-004 | P1 keyboard / platform | Tab reaches buttons; Enter and Space activate; focus outline visible by computed style; skip link leads to main | `npm run check`; manual VoiceOver |
| DS-005 | P1 script unavailable / error | Useful static content and downloads remain; disabled demo controls and honest static caption; no fake interactivity | `npm run check` |
| DS-006 | P1 recovery | Reload restores documented initial state; no storage needed; blocked bundle stays static | `npm run check` |
| DS-007 | P0 privacy | Initial load and demo actions never probe devices, submit data, use cookies/storage or clipboard; external fonts documented and blocked in tests | `npm run check` request inspection + source review |
| DS-008 | P2 reduced motion | Smooth scrolling and transitions disabled when reduce preference active | `npm run check` |
| DS-009 | P1 navigation | Every nonempty fragment resolves; internal resources load; security link says Security | `npm run check` |
| DS-010 | P0 releases | Visible version, JSON-LD, release notes and arm64 asset agree with validated published release | `npm run check:release -- RECEIPT.json --online` |
| DS-011 | P2 metadata | One h1; title/description/canonical/OG/Twitter image/alt and valid application JSON-LD present | `npm run check` |
| DS-012 | P1 404 / error-recovery | Emitted 404 is noindex, explains missing page and links home; nested unknown request renders it with 404 in fixture host | `npm run check`; deployed CDN check after publishing |
| DS-013 | P1 security / platform | Build preserves framing, content-type, referrer and device policy headers; proxy preserves method, query and upstream 404 | Artifact checks + isolated router test in `npm run check`; deployed headers checked after publishing |
| DS-014 | P1 cross-browser / platform | Desktop Chrome, Playwright Firefox and WebKit run same core and enlarged-text suite | `npm run check:engines`; physical Safari/iOS/Android acceptance remains manual |
| DS-015 | P1 visual accessibility / manual | VoiceOver names/order/live status and visible focus, contrast, reflow acceptable | Browser screenshots help review; manual acceptance deferred |
| DS-016 | P0 product truth / manual | Claims match released native capabilities; actual pair/handoff/clipboard/DDC verified by product QA | Native app QA; browser tests do not establish physical acceptance |
| DS-017 | P1 text enlargement / accessibility | At 200% computed font sizes, headings/buttons/content reflow at 1440/768/390/320 without horizontal overflow or clipped key labels; keyboard demo/download focus remain usable | `npm run check:engines`; synthetic text-only enlargement, not physical zoom |
| DS-018 | P1 changed motion preference / recovery | Switching no-preference to reduce changes smooth scrolling to auto and disables control transitions immediately | `npm run check:engines` |
| DS-019 | P0 external public links | Current public source/security/issues/sponsor/website/release/archive destinations return successful HTTP after redirects without credentials or downloading body | `npm run check:links`, explicit read-only network opt-in |
| DS-020 | P1 incoming icon assets | SVG favicon, ICO fallback and Apple touch PNG exist in built output and decode in Chrome/Firefox/WebKit | `node scripts/check-hygiene.mjs` |
| DS-021 | P1 legal/contact footer | Exact approved Privacy/Terms/Contact destinations; keyboard focus/order and footer reflow at four widths and 200% text; no mail/app navigation during QA | `node scripts/check-hygiene.mjs`; native VoiceOver/manual deferred |
| DS-022 | P0 release receipt failure/recovery | Reject draft/unpublished/missing or incomplete assets/wrong repo/stale source; exact published receipt matches source+build; optional online mode verifies actual ZIP bytes against checksum | `node scripts/check-release.mjs RECEIPT.json [--online]`; `node --test scripts/check-release.test.mjs` synthetic fixtures |
| DS-023 | P1 footer contrast | Small footer text has at least 4.5:1 contrast and focus outline at least 3:1 against actual page background | `node scripts/check-hygiene.mjs`; perceived focus/VoiceOver still manual |

Run `npm run build && npm run check`. Browser harness serves only built files on
an ephemeral loopback port, blocks all external network, writes ignored synthetic
screenshots/results under test-results, and closes its own browser/server.
Do not interpret fixture HTTP checks as deployed Cloudflare acceptance.
