# Deploy map

Snapshot of 2026-10-07, read-only. Nothing was archived, paused, deleted or changed. Source: the Vercel API, the live pages, and the deploy metadata of 49 projects across two teams.

## Production at a glance

| What | Where it lives |
|---|---|
| The public site, www.the37thmove.com | Vercel project **studio-x37-television-preview** (Quantum Tonic team). Vite. Built from the repo `Domnoval/Pink-Television-Website-`. Last production deploy 2026-09-27. |
| the37thmove.com, tonicthoughtstudios.com, 137studios.com (and their www forms) | All attached to the same project and redirecting (308) to www.the37thmove.com. |
| shop.the37thmove.com | A Shopify storefront ("Studio 137"). Not on Vercel. |
| console.the37thmove.com | Vercel project **studio137**. "The console that turns on you". Separate and healthy. |
| tccyg.com, twincityconcreteyardandgarden.com | Vercel project **kurts-website-final**. A **client's live site** (Twin City Concrete Yard & Garden), built from `Domnoval/tccyg-site` and edited by the client through a CMS. Never touch it. |

The pink TV is the first row. The project name does not say "pink": the pink is in the repo name and the hero image.

## Repo to project

| Repo | Vercel projects that build it | Notes |
|---|---|---|
| `Domnoval/Pink-Television-Website-` | studio-x37-television-preview | Production. |
| `Domnoval/137-studio` (Next.js) | **137-studio** and **tonic-quantum-leap** | tonic-quantum-leap is a duplicate. Its deployments are blocked, which puts a permanent red check on PRs. 137-studio has no custom domain and no production deploy since 2026-05-04. |
| `Domnoval/tccyg-site` | kurts-website-final (live), kurts-patched-rebuild (empty) | Client site. |
| `Domnoval/Simple-website` | the37thmove | Superseded front door. |
| `Domnoval/THE_37TH_MOVE` | the-37-th-move and 1.4 to 1.8 (TEAM_CHEEZE) | Paused duplicates. |

## Merging does not publish

Merging a PR to `137-studio` main builds the 137-studio project only. It does not publish anything on your public domains. A page that must be public has to be added to the pink TV repo, or the domain must be pointed at a different project.

## Security follow-ups

These came out of the read. No secret values were read or recorded here.

1. **137-tarot** has a hardcoded API key named `GEMINI_KEY` in client-side code (`src/app/page.tsx`). Treat it as exposed: rotate it in the Google AI console.
2. **sacred-gallery-2-n2q8** (and probably its twin sacred-gallery-2) has an `ANTHROPIC_API_KEY` env var that Vercel flags as a readable secret. Rotate or remove it on purpose. Archiving the project does not revoke it.
3. About six sampled Claude sessions show credentials pasted into chat (including a shop credential, a print-on-demand token, a deploy platform token and an API credential). Values were not recorded. Treat anything pasted into chat as exposed, rotate it, and put secrets in the environment's secrets settings instead.

## Archive guidance

Only **project-f8yrf** passed two independent checks (an empty project, no deployments, no custom domain). Eleven other projects were first called safe to archive, and a second reviewer could not confirm any of them unused. Most are blocked by things this session cannot read (the repos behind them, and their env vars), not by evidence of use. The Archive column says what is blocking each one. Before archiving anything: check the repo's recent commits, check env vars by name, and confirm nothing links to it.

## Tool quirks

- The Vercel API behaves oddly for Quantum Tonic: `list_projects` with `teamId` returns 1 project, while the same call without `teamId` returns all 34. Use unscoped calls for that team.
- TEAM_CHEEZE needs its `teamId` or the slug `team-cheeze`. The display name `TEAM_CHEEZE` returns 403.
- Many paused projects return 503 `DEPLOYMENT_PAUSED`. Who paused them, and why, was not visible. If you did not pause them, check Vercel billing and usage.

## Quantum Tonic projects (28 inspected, plus 6 known)

| Project | Team | Role | Last prod deploy | Custom domains | What it is | Archive |
|---|---|---|---|---|---|---|
| studio-x37-television-preview | Quantum Tonic | live-production | 2026-09-27 READY | www.the37thmove.com + 3 redirecting apex domains | Pink retro TV landing page and the Studio X37 app lineup | keep |
| studio137 | Quantum Tonic | channel-or-app | 2026-06-09 READY | console.the37thmove.com | "Studio 137: The console that turns on you" | keep |
| 137-studio | Quantum Tonic | experiment | 2026-05-04 READY | none | The Next.js app: /137 temple, geometry, repeat forge and more | keep |
| tonic-quantum-leap | Quantum Tonic | duplicate | 2026-05-04 READY (latest BLOCKED) | none | Duplicate of 137-studio. Source of the red check | disconnect the repo (your Vercel dashboard) |
| the37thmove | Quantum Tonic | stale | 2026-09-10 READY | none | Old front door from `Simple-website`, superseded | hold: confirm nothing links to it |
| transmission-037 | Quantum Tonic | unknown | 2026-07-20 READY | none | Not inspected closely | hold |
| 137-art-vault | Quantum Tonic | channel-or-app | 2026-04-02 READY | none | Dark-themed artwork inventory and catalog manager (Space Grotesk and Tailwind UI) for tracking works by medium, status,… | keep |
| 137-codex | Quantum Tonic | channel-or-app | 2026-06-17 READY | none | Interactive symbol encyclopedia ('137 Codex': 731 symbols across 37 traditions, with Scriptorium and Translate 137 tool… | keep |
| 137-cycles | Quantum Tonic | channel-or-app | 2026-03-04 READY | none | A dark-themed 'celestial life instrument' (a biorhythm, numerology and cycles calculator based on H. Spencer Lewis's 7… | keep |
| harmonic-arcana | Quantum Tonic | channel-or-app | 2026-02-19 READY | harmonic-arcana.vercel.app (Vercel-managed alias only; no custom domain) | A single-page tarot (22 Major Arcana) tool linking Hebrew letters, planets and notes, with spreads, journal/calendar, 3… | keep |
| lionsgate-photos | Quantum Tonic | channel-or-app | 2026-05-19 READY | none | Marketing site for 'Lionsgate — Collaborative Events', a Lazy Lake, Florida venue for senior-level gatherings. Static H… | keep |
| lyric-lab | Quantum Tonic | channel-or-app | 2026-03-02 ERROR | none | An AI songwriting helper for Suno users: paste raw lyrics, pick rhythmic style, song structure, rhyme scheme and mood l… | keep |
| studio137-pay | Quantum Tonic | channel-or-app | 2026-03-22 READY | pay.the37thmove.com | Single-page 'Studio 137 - Pay' landing page with tap-through payment links for Venmo, Cash App and Zelle (tap-to-copy),… | keep |
| the-book | Quantum Tonic | channel-or-app | 2026-02-27 READY | none | Next.js PWA 'The Book - Gambling P&L Ledger', a dark-mode personal profit-and-loss ledger app that renders client-side… | keep |
| 137-cipher | Quantum Tonic | experiment | 2026-02-25 READY | none | Next.js interactive glyph toy '137 Cipher: The Language Underneath': type text and see it rendered in a custom 137 Sacr… | keep |
| 137-geometry | Quantum Tonic | experiment | 2026-03-06 READY | none | Working sacred geometry SVG generator (Flower of Life, Seed of Life, Metatron's Cube, Sri Yantra, Platonic solids, Tree… | keep |
| 137-mind | Quantum Tonic | experiment | 2026-03-11 READY | none | Small knowledge-graph toy titled '137 Mind - The Universal Bowl' (54 nodes, 82 edges, filter buttons for predict/discov… | keep |
| 137-pad | Quantum Tonic | experiment | 2026-03-05 READY | none | Infinite-canvas note-taking PWA ('137 Pad') with radial toolbar, S Pen support and sacred geometry tools; the static HT… | keep |
| 137-pattern-engine | Quantum Tonic | experiment | 2026-03-16 READY | none | Working 'Sacred geometry pattern generator for product design' web app (v2.0): encodes messages into geometric scripts… | keep |
| 137-resonance | Quantum Tonic | experiment | 2026-03-04 READY | none | A 432 Hz 'Sacred Sound Architecture' music toy with chord keys (A minor, 108 BPM), drum pads and a waveform oscilloscop… | keep |
| dungeon-builds | Quantum Tonic | experiment | none  | none | Dark, gold-on-black one-page marketing site for Dungeon Builds, 'functional art for small spaces' (fold-flat wall art f… | keep |
| franks-stories | Quantum Tonic | experiment | 2026-02-23 READY | none | Frank's Stories, a voice memoir app for veterans (tap, talk, preserve your stories); the live page is a minimal Next.js… | keep |
| hermes-house | Quantum Tonic | experiment | 2026-04-09 READY (2 production deploys total, both READY on 2026-04-09; newest deployment of any kind is the same one) | none | A custom-designed personal 'alchemical workspace' dashboard for Michael MacDonald (Domnoval's Workspace) with rooms lik… | keep |
| lionsgate-demo | Quantum Tonic | experiment | 2026-05-19 ERROR (newest 3 production deploys, 2026-05-19 and earlier that day, all ERROR). Last READY production deploy was 2026-03-24. | none | A polished marketing site for a luxury event venue in Lazy Lake, Florida (Lionsgate Events Venue), built as a client de… | keep |
| speak23d | Quantum Tonic | experiment | 2026-02-22 READY | none | Speak23D, a tool that generates 3D-printable backlit house numbers and names from voice or text input and exports STL/3… | keep |
| kurts-website-final | Quantum Tonic | live-production | 2026-09-17 READY | tccyg.com, www.tccyg.com, twincityconcreteyardandgarden.com, www.twincityconcreteyardandgarden.com | A live client website for Twin City Concrete Yard & Garden in Minneapolis (hand-cast concrete address rocks with LED li… | keep |
| 137-tarot | Quantum Tonic | stale | 2026-03-07 READY | none | A paused, CLI-deployed 3D tarot-reading app (react-three-fiber with a 78-card deck, spreads, interpretation logic, star… | keep |
| out | Quantum Tonic | stale | 2026-06-07 READY | none | Static Next.js export of an early Studio 137 intro: black screen with a muted intro video (assets/source_clip.mp4) and… | keep |
| temp-proposal | Quantum Tonic | stale | 2026-03-22 READY | none | Static dark-theme proposal or recap page titled '137 Studio — What We Built', covering 45 days of building (Feb 7 to Ma… | keep |
| kurts-patched-rebuild | Quantum Tonic | throwaway | none (proj none (latestDeployment is null; list_deployments returned count 0 for both production and unfiltered) | none | An empty Vercel project shell that was created on 2026-05-11 and never deployed, so its only URL returns a 404. | hold: empty shell, probably staging for the live client site kurts-website-final |
| project-f8yrf | Quantum Tonic | throwaway | none none (no production deployment has ever existed) | none | Empty Vercel project with zero deployments, created 3 minutes before studio137-pay; it looks like an abandoned first at… | candidate (passed two refutation checks) |
| project-sdskb | Quantum Tonic | throwaway | never  | none | Empty Vercel project shell with zero deployments; its vercel.app URL returns DEPLOYMENT_NOT_FOUND. | hold: empty shell, but its team scope is inconsistent and git link unverified |
| steve-reading | Quantum Tonic | throwaway | 2026-03-02 READY | none | One-off static HTML page 'A Reading from the Wildwood': a six-card forest tarot-style reading with an audio player, wri… | keep |
| workspace | Quantum Tonic | throwaway | 2026-07-30 READY | none | A one-file test page whose entire content is the word "probe"; it looks like a connectivity or deploy-pipeline test. | keep |

## TEAM_CHEEZE projects (14 inspected, plus 1 known)

| Project | Team | Role | Last prod deploy | Custom domains | What it is | Archive |
|---|---|---|---|---|---|---|
| 137studios | TEAM_CHEEZE | stale | 2025-10-05 ERROR | none | Old Next.js project, last production deploy errored | hold: check before archiving |
| the-37-th-move | TEAM_CHEEZE | experiment | 2025-09-03 READY | none | Working 'THE37thMOVE - Interactive AI Gallery' page (dark gradient UI, conversational AI artworks with personality filt… | keep |
| design-oracle | TEAM_CHEEZE | stale | 2025-09-17 READY | design-oracle-omega.vercel.app (Vercel-managed alias only; no custom domain) | A Next.js AI design-assistant / live website generator (GPT-4o /api/generate-website, /api/deploy-website, and an Expla… | keep |
| endless-paper | TEAM_CHEEZE | stale | none  | none | Vite plus Tailwind v4 app from the endless_paper GitHub repo, last redeployed Sept 2025; content not viewable because t… | keep |
| playground2 | TEAM_CHEEZE | stale | none  | none | Vite web app (a 'full website build' merged from a feature branch), last deployed Sept 2025; content not viewable becau… | keep |
| sacred-gallery-2 | TEAM_CHEEZE | stale | 2025-11-28 READY | none | Vite app from the Domnoval/sacred-gallery-2 repo, a sacred-gallery generative color-cycling piece (inferred from the co… | keep |
| endless_paper | TEAM_CHEEZE | throwaway | none  | none | Default 'created from vercel.com/new' Next.js starter clone (initial commit only), never redeployed; the same repo now… | hold: has an EDGE_CONFIG binding to an Edge Config store; its sibling endless-paper does not |
| playground2.55 | TEAM_CHEEZE | throwaway | 2025-09-09 ERROR | none | Failed Vite build of the Domnoval/playground2 repo (a 'full website build' branch merged via PR #1); it never produced… | hold: failed build of the playground2 repo; repo activity not checked |
| sacred-gallery-2-n2q8 | TEAM_CHEEZE | throwaway | 2025-11-28 READY | none | Duplicate Vite import of the Domnoval/sacred-gallery-2 repo (a sacred-gallery color-cycling piece, inferred from the co… | hold: env var ANTHROPIC_API_KEY (flagged readable-secret) and a serverless function; twin of sacred-gallery-2 |
| the-37-th-move-1.4 | TEAM_CHEEZE | throwaway | 2025-09-03 READY | none | Paused duplicate of an old Interactive AI Gallery static app; the .vercel.app URL now returns a 503 DEPLOYMENT_PAUSED e… | hold: paused duplicate; repo THE_37TH_MOVE not checked for recent commits |
| the-37-th-move-1.5 | TEAM_CHEEZE | throwaway | 2025-09-03 READY | none | Paused duplicate of an old Interactive AI Gallery static app; the .vercel.app URL now returns a 503 DEPLOYMENT_PAUSED e… | hold: paused duplicate; repo THE_37TH_MOVE not checked for recent commits |
| the-37-th-move-1.6 | TEAM_CHEEZE | throwaway | 2025-09-03 READY | none | Paused duplicate Vercel project of the THE_37TH_MOVE repo (static homepage and upload page with edge functions, per com… | hold: paused duplicate with a custom domain attached; repo not checked |
| the-37-th-move-1.7 | TEAM_CHEEZE | throwaway | 2025-09-03 READY | none | Paused duplicate Vercel project of the THE_37TH_MOVE repo (static homepage and upload page with edge functions, per com… | hold: paused duplicate with a custom domain attached; repo not checked |
| the-37-th-move-1.8 | TEAM_CHEEZE | throwaway | 2025-09-03 READY | none | Paused duplicate Vercel project of the THE_37TH_MOVE repo (static homepage and upload page with edge functions, per com… | hold: paused duplicate with a custom domain attached; repo not checked |
| vite-react | TEAM_CHEEZE | throwaway | 2025-11-24 READY | vite-react-sepia-kappa-95.vercel.app (Vercel-managed alias only; no custom domain) | Default Vite + React starter created from the Vercel new-project template with a single initial commit and never touche… | hold: default starter, but paused and its repo was not checked |

## What is not verified

- The repos behind most projects were out of reach (this session can read only 137-studio and tabula-rosetta), so recent commit activity is unknown for them.
- Env vars were checked by name only where noted, and Speed Insights and integrations could not be read.
- Page content was not visible for projects that are paused or behind Vercel login.
- Role labels are one reviewer's reading of each project's page and metadata, not a decision by you.
