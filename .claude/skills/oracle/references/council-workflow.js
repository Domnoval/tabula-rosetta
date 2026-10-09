export const meta = {
  name: 'oracle-council',
  description: 'Full Oracle council: six seers, two critics per candidate, three judges, a synthesizer and a rules audit',
  phases: [
    { title: 'Seers', detail: 'six lenses propose four paths each' },
    { title: 'Critique', detail: 'a taste critic and a reality critic on every candidate' },
    { title: 'Judge', detail: 'three judges compose a round from different priorities, one synthesizes' },
    { title: 'Audit', detail: 'adversarial rules audit, corrected until clean' },
  ],
}

// Oracle council pipeline, reusable through the Workflow tool:
//   Workflow({ scriptPath: '.claude/skills/oracle/references/council-workflow.js', args })
// args: {
//   round: number,               // the round being composed (a new question's id is r<round>-<slug>)
//   brief: string,               // the situation, written abstractly: never personal specifics
//   ledgerFacts: string[],       // store facts the ledger may reuse (aggregate only)
//   previousTitles: string[],    // every earlier path and bench title, so nothing repeats
//   questions?: { id: string, question: string, answer?: string }[],
//                                // every earlier question from oracle/learned.md and field.json, with a
//                                // one-line answer at a distance when answered (an unanswered one asked
//                                // again keeps its id; an answered one is never asked again)
// }
// It returns { round, auditClean, lastViolations, stats, killedByBoth }. It writes nothing:
// hearing the answers, learned.md, field.json and the page database stay with the main session
// (see SKILL.md, "Hearing the answers" and "Writing"), which checks the question against
// oracle/learned.md before writing it.

const ROOT = '/home/user/tabula-rosetta'
const A = args
const R = A.round

const PATH_PROPS = {
  seer: { type: 'string' },
  title: { type: 'string' },
  why: { type: 'string' },
  firstMove: { type: 'string' },
  mode: { type: 'string', enum: ['collision', 'inversion', 'escalation', 'wrongtool'] },
  ring: { type: 'integer', minimum: 1, maximum: 3 },
  reachDays: { type: 'number' },
  surprise: { type: 'integer', minimum: 1, maximum: 5 },
  money: { type: 'integer', minimum: 0, maximum: 3 },
  fuel: { type: 'array', items: { type: 'string' } },
  tools: { type: 'array', items: { type: 'string' } },
  sources: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } }, required: ['label', 'url'] } },
  spends: { type: 'string' },
  doubt: { type: 'string' },
}
const PATH_REQ = ['seer', 'title', 'why', 'firstMove', 'mode', 'ring', 'reachDays', 'surprise', 'money', 'fuel', 'tools', 'sources', 'spends', 'doubt']

const SEER_SCHEMA = {
  type: 'object',
  properties: {
    notes: { type: 'array', items: { type: 'string' } },
    paths: { type: 'array', items: { type: 'object', properties: Object.assign({}, PATH_PROPS, { killedAlternatives: { type: 'array', items: { type: 'string' } } }), required: PATH_REQ.concat(['killedAlternatives']) } },
  },
  required: ['notes', 'paths'],
}

const TASTE_SCHEMA = {
  type: 'object',
  properties: {
    keep: { type: 'boolean' },
    surprise: { type: 'integer', minimum: 1, maximum: 5 },
    wouldTypeAnyway: { type: 'string', enum: ['yes', 'maybe', 'no'] },
    slopFlags: { type: 'array', items: { type: 'string' } },
    doubt: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['keep', 'surprise', 'wouldTypeAnyway', 'slopFlags', 'doubt', 'notes'],
}

const REALITY_SCHEMA = {
  type: 'object',
  properties: {
    keep: { type: 'boolean' },
    runnableNow: { type: 'boolean' },
    constraintViolations: { type: 'array', items: { type: 'string' } },
    factualFlags: { type: 'array', items: { type: 'string' } },
    toolCheck: { type: 'array', items: { type: 'string' } },
    honestMoney: { type: 'integer', minimum: 0, maximum: 3 },
    doubt: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['keep', 'runnableNow', 'constraintViolations', 'factualFlags', 'toolCheck', 'honestMoney', 'doubt', 'notes'],
}

const ROUND_PATH_PROPS = Object.assign({}, PATH_PROPS, { id: { type: 'string' }, isWildcard: { type: 'boolean' }, isMoney: { type: 'boolean' } })
const ROUND_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', maxLength: 120 },
    situation: { type: 'string', maxLength: 500 },
    question: { type: 'string', maxLength: 200 },
    questionId: { type: 'string', pattern: '^r[0-9]+-[a-z0-9-]+$' },
    questionOptions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', maxLength: 60 } },
    paths: { type: 'array', items: { type: 'object', properties: ROUND_PATH_PROPS, required: PATH_REQ.concat(['id', 'isWildcard', 'isMoney']) } },
    bench: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, seer: { type: 'string' }, mode: { type: 'string' }, why: { type: 'string' }, held: { type: 'string' } }, required: ['title', 'seer', 'mode', 'why', 'held'] } },
    rationale: { type: 'string' },
  },
  required: ['headline', 'situation', 'question', 'questionId', 'questionOptions', 'paths', 'bench', 'rationale'],
}

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    clean: { type: 'boolean' },
    violations: { type: 'array', items: { type: 'string' } },
    round: ROUND_SCHEMA,
  },
  required: ['clean', 'violations', 'round'],
}

const RULES = [
  'THE RULES FROM THE ARTIST (law):',
  '1. Money gets one seat. Exactly one path per round is the money path; every other path is judged only on strangeness and fit and may earn nothing. Score money honestly: 0 or 1 for paths that are not about earning.',
  '2. No placation. Every path carries a doubt: the strongest honest objection (what is most likely wrong, what it assumes that nobody checked). Never call an idea good because it exists.',
  '3. Questions to the artist must be easy to answer: one question, 2 to 4 mutually exclusive tappable options of at most 60 chars, free text always allowed so never an "Other" option.',
  '4. Personal history may be material only as the artist allows (see the lens): by default only at a distance, as themes, never people, their circumstances or specifics.',
  '5. Work the situation says is spoken for is not inventory. Do not sell it, market it or build on it, do not research or contact anyone about it, and do not invent facts about it.',
  '6. Paths are about the art, the work, the money and the world, never about the Oracle or Claude tooling unless it is a tool for making or selling art. No generic sacred-geometry look (glowing mandalas, lotus, orbs, gold on black). No growth-hack energy, no mainstream creator-economy advice, no lame design, no hygiene work for its own sake.',
  '7. No customer personal data anywhere. Do not read Gmail or Google Drive. Shopify reads are allowed for the ledger only, read-only, aggregate.',
  '8. No first move may spend credits, publish, deploy, write to a store, send a message or contact anyone without the artist\'s explicit yes; such steps are drafted and flagged in spends instead.',
  '9. Do not repeat earlier rounds. Earlier titles are listed below. You may revive an earlier idea only if the new facts transform it; say what changed.',
].join('\n')

const QUESTIONS = (A.questions || []).map(q => q.id + ': ' + q.question + ' -> ' + (q.answer ? 'ANSWERED: ' + q.answer : 'unanswered'))
const SITUATION = A.brief + '\n\nSTORE FACTS (from the ledger, read-only, 2026-10-08):\n- ' + A.ledgerFacts.join('\n- ') + '\n\nEARLIER TITLES (do not repeat):\n- ' + A.previousTitles.join('\n- ') + '\n\nEARLIER QUESTIONS TO THE ARTIST (id: question -> answer):\n- ' + (QUESTIONS.length ? QUESTIONS.join('\n- ') : 'none listed; read ' + ROOT + '/oracle/learned.md')

const SEER_HEAD = name => 'You are the ' + name + ', one seer on an artist\'s Oracle council. The council proposes paths the artist would NOT think of themselves, grounded in what is true about their work, their tools and the world.\n\nREAD FIRST: ' + ROOT + '/oracle/lens.md, ' + ROOT + '/docs/DEPLOY.md, ' + ROOT + '/connectors.md. (The lens may be mid-edit; the rules below win where they differ.)\n\nSITUATION, ROUND ' + R + ':\n' + SITUATION + '\n\n' + RULES

const SEER_TAIL = [
  'OUTPUT: 4 candidate paths. Fields: seer (your name), title (at most 48 chars), why (at most 140 chars, the payoff, not the process), firstMove (at most 600 chars: a complete instruction the artist could send to Claude as written to start now, naming real files, tools or products), mode, ring (1 a visible result this week, 2 a stretch, 3 another planet), reachDays (days to the first visible result), surprise (1-5, honest), money (0-3, honest), fuel (from worlds, toolbox, outside, picks, ledger), tools (real names), sources ({label,url}; label any source you could not open with "(not opened)" and never state its numbers as fact), spends (at most 60 chars, empty if the first move is free), doubt (at most 200 chars, the strongest honest objection), killedAlternatives (up to 3 short strings: ideas you rejected as obvious or slop, and why).',
  'Before keeping any idea ask "would this artist type this next anyway?" and "would a mainstream creator-economy post say this?"; if yes, kill it and replace it. At most one of your four may be primarily about earning (money 2 or more); at most one may be ring 3. Do not edit any file. Dry wit, no emoji, no placating language.',
].join('\n')

const SEERS = [
  { name: 'collider', lens: 'YOUR LENS: COLLISION (mode collision). Fuse two or more of the artist\'s worlds and/or assets into a third thing with its own logic and an audience who would want it. Not a mashup. The return after a long absence is allowed as a distant theme (thresholds, waiting, return), never the specifics.' },
  { name: 'inverter', lens: 'YOUR LENS: INVERSION (mode inversion). Attack a premise the setup silently assumes (the work is for sale; the buyer is the audience; the work is permanent; the artist makes and the collector receives; the site is open; a pause is lost time) and flip it; keep only what survives and is worth making. Say what breaks and what survives.' },
  { name: 'escalator', lens: 'YOUR LENS: ESCALATION (mode escalation). First use WebSearch to find the real 2025-2026 frontier in interactive, generative, signal-themed and consciousness-themed art. WebFetch is blocked for most hosts in this sandbox: you may cite search results, labeled "(not opened)". Then push something the artist already has ten times past anything that exists, to a different category of thing, with a first move that shows something within days.' },
  { name: 'wrongtool', lens: 'YOUR LENS: WRONG TOOL, RIGHT RESULT (mode wrongtool). Raid the connected toolbox (GitHub, Vercel, Netlify, Supabase, Figma, Canva, Adobe, Shopify, Higgsfield, Spotify, Play Sheet Music, PubMed, Hugging Face, tldraw, Three.js viewer, Artifacts with a live database, Claude agents and scheduled routines) for improbable uses. Use ToolSearch to confirm what a tool really does before building on it; read schemas only, execute nothing. Avoid defaulting to Higgsfield generation.' },
  { name: 'ledger', lens: 'YOUR LENS: THE MONEY SEAT (modes mix). You are the council\'s source for the money path: all four of your paths are money candidates and may score 2 or 3. Read the brief for what is known about past buyers and the artist\'s time, and find the money that re-warms what already worked, with a twist the artist would not think of (not "run a sale", not "post more", not an email blast). You may re-check Shopify read-only (ToolSearch for mcp__Shopify__ read tools), aggregate only; do not read Gmail or Drive. Never build on work the brief says is spoken for.' },
  { name: 'scout', lens: 'YOUR LENS: OUTSIDE EVIDENCE (modes mix). Use WebSearch to find how artists in adjacent territory actually make work and money after long breaks or in returns, and how dark, occult-adjacent, signal-themed or consciousness-themed artists sustain practice in 2025-2026: mechanisms, not vibes. WebFetch is mostly blocked; label search-only sources "(not opened)". Convert the best into paths adapted to this artist, with a twist that makes them theirs.' },
]

const isKeeper = c => c && c.taste && c.reality && (c.taste.keep || c.reality.keep)

phase('Seers')
const critiqued = await pipeline(
  SEERS,
  s => agent(SEER_HEAD(s.name) + '\n\n' + s.lens + '\n\n' + SEER_TAIL, { label: 'seer:' + s.name, phase: 'Seers', schema: SEER_SCHEMA }),
  (out, s) => parallel((out ? out.paths : []).map((p, i) => () => parallel([
    () => agent('You are the TASTE CRITIC on an artist\'s Oracle council. Be hard to please. Judge this one candidate path.\n\nSITUATION:\n' + SITUATION + '\n\n' + RULES + '\n\nREAD ' + ROOT + '/oracle/lens.md for the artist\'s worlds and slop list.\n\nCANDIDATE:\n' + JSON.stringify(p, null, 1) + '\n\nDecide: would this artist type it next anyway (yes/maybe/no)? Which slop flags apply (generic sacred-geometry look, mainstream creator advice, growth-hack, hygiene, lame design, about the Oracle)? Honest surprise 1-5. Write the strongest taste doubt in at most 200 chars. keep=false if it is obvious or slop. Do not edit files.', { label: 'taste:' + s.name + ':' + i, phase: 'Critique', schema: TASTE_SCHEMA }),
    () => agent('You are the REALITY CRITIC on an artist\'s Oracle council. Be hard to fool. Judge this one candidate path.\n\nSITUATION:\n' + SITUATION + '\n\n' + RULES + '\n\nCANDIDATE:\n' + JSON.stringify(p, null, 1) + '\n\nCheck: can the first move actually run now? Confirm every named tool exists with ToolSearch and every named repo file or project with Read/Glob/Grep under ' + ROOT + ' or in ' + ROOT + '/docs/DEPLOY.md. List violations of rules 4, 5, 7 and 8 explicitly. Flag every factual claim that is unverified or comes from an unopened source. Give the honest money score (0-3). Write the strongest reality doubt in at most 200 chars. keep=false if it breaks a rule or cannot start. Do not edit files and do not execute any tool other than reading and ToolSearch.', { label: 'reality:' + s.name + ':' + i, phase: 'Critique', schema: REALITY_SCHEMA }),
  ]).then(([taste, reality]) => ({ seer: s.name, candidate: p, taste, reality })))),
)

const pool = critiqued.filter(Boolean).flat().filter(Boolean)
const keepers = pool.filter(isKeeper)
log(pool.length + ' candidates critiqued; ' + keepers.length + ' kept by at least one critic; ' + (pool.length - keepers.length) + ' killed by both')

const POOL_TEXT = JSON.stringify(pool.map(c => ({
  seer: c.seer,
  candidate: c.candidate,
  taste: c.taste && { keep: c.taste.keep, surprise: c.taste.surprise, wouldTypeAnyway: c.taste.wouldTypeAnyway, slopFlags: c.taste.slopFlags, doubt: c.taste.doubt },
  reality: c.reality && { keep: c.reality.keep, runnableNow: c.reality.runnableNow, constraintViolations: c.reality.constraintViolations, factualFlags: c.reality.factualFlags, honestMoney: c.reality.honestMoney, doubt: c.reality.doubt },
})))

const COMPOSE = [
  'COMPOSE ROUND ' + R + ' from the critiqued pool below. Requirements:',
  '- Exactly six paths: five reachable (ring 1 or 2) and one wildcard (ring 3, isWildcard true) that still has a first move runnable now.',
  '- Exactly one isMoney path: the best money bet, chosen for its chance of producing real evidence from the people who already bought before the pause. Every other path has money 0 or 1 (use the reality critic\'s honest score).',
  '- All four modes appear. No seer supplies more than two paths. Never pick a candidate both critics killed, or one with a rule 4, 5, 7 or 8 violation, unless you rewrite it so the violation is gone and say so.',
  '- Every path gets a doubt (at most 200 chars) that is honest and specific: merge the best of the seer\'s, the taste critic\'s and the reality critic\'s doubts. Never a compliment in disguise.',
  '- Rewrite title (<=48), why (<=140), firstMove (<=600), spends (<=60). id is a lowercase slug. Sources keep their "(not opened)" labels.',
  '- headline (<=120): what the Oracle sees about the moment, said by a sharp collaborator, not a summary of the paths. situation (<=500): the true situation in plain words; never people, personal circumstances, or anything the artist has not said may be public.',
  '- question (<=200), questionId, questionOptions: 2 to 4 mutually exclusive options of at most 60 chars with a clear line between them (concrete buckets, not "a few" against "often"), no "Other". Ask the one thing that would most change the next judgment and that cannot be read from the repo, the stores, ' + ROOT + '/oracle/learned.md (read it) or the earlier questions above. Never ask an answered question again, in any wording. A new question gets the id "r' + R + '-<slug>"; an unanswered earlier question asked again keeps its listed id.',
  '- bench: every strong candidate you held back, with one line on why (held <=140).',
  '- rationale: a few sentences on why these six, and what you deliberately left out.',
].join('\n')

phase('Judge')
const PRIORITIES = [
  { key: 'strange', text: 'YOUR PRIORITY: strangeness. Prefer the paths the artist was least likely to think of, as long as they are real.' },
  { key: 'return', text: 'YOUR PRIORITY: the return. Prefer paths that turn the next weeks into momentum for a practice coming back after a long pause, with most days available.' },
  { key: 'learning', text: 'YOUR PRIORITY: learning. Prefer paths that teach the artist and the Oracle the most about what works now, fastest and with the least waste.' },
]
const drafts = (await parallel(PRIORITIES.map(pr => () => agent(
  'You are a JUDGE on an artist\'s Oracle council.\n\nSITUATION:\n' + SITUATION + '\n\n' + RULES + '\n\n' + pr.text + '\n\n' + COMPOSE + '\n\nCRITIQUED POOL:\n' + POOL_TEXT + '\n\nDo not edit files.',
  { label: 'judge:' + pr.key, phase: 'Judge', schema: ROUND_SCHEMA })))).filter(Boolean)

const synthesized = await agent(
  'You are the SYNTHESIZER on an artist\'s Oracle council. Three judges composed round ' + R + ' from the same critiqued pool with different priorities (strangeness, the return, learning). Produce the final round: start from the strongest draft, graft the best paths and lines from the others, and resolve conflicts by the rules. Be honest in the doubts and do not flatter.\n\nSITUATION:\n' + SITUATION + '\n\n' + RULES + '\n\n' + COMPOSE + '\n\nDRAFTS:\n' + JSON.stringify(drafts.map((d, i) => ({ priority: PRIORITIES[i] ? PRIORITIES[i].key : 'unknown', draft: d }))) + '\n\nCRITIQUED POOL (for reference):\n' + POOL_TEXT + '\n\nDo not edit files.',
  { label: 'synthesize', phase: 'Judge', schema: ROUND_SCHEMA })

phase('Audit')
const AUDIT_RULES = [
  'Check every item and fix violations directly in the round you return:',
  '- exactly 6 paths; exactly one isWildcard (ring 3); the other five ring 1 or 2; exactly one isMoney; non-money paths have money 0 or 1; all four modes present; no seer more than twice; ids unique lowercase slugs.',
  '- limits: title <=48, why <=140, firstMove <=600, doubt <=200, spends <=60, headline <=120, situation <=500, question <=200, each option <=60, 2 to 4 options, questionId matches r' + R + '-<slug> for a new question or is the listed id of an unanswered earlier question asked again.',
  '- every doubt is a real objection (not praise, not "it might be hard"); every firstMove can be sent as written and needs no unapproved spending, publishing, deploying, store write or contact (those must be flagged in spends and drafted, not done).',
  '- rule 4: no people, circumstances or specifics from the artist\'s personal history anywhere. rule 5: work that is spoken for is never sold, marketed or built on, and no facts are invented about it. rule 7: no customer data, no Gmail or Drive reads in first moves. rule 9: no repeats of the earlier titles unless transformed and the change is stated.',
  '- the question is a single question, the options are mutually exclusive and easy to tap, no "Other". It is not an earlier question listed as ANSWERED, in any wording, and nothing in ' + ROOT + '/oracle/learned.md already answers it.',
  '- sources: anything not opened is labeled "(not opened)"; no unopened numbers stated as fact in why, firstMove or doubt.',
  'Return clean=true only if you found nothing to fix. List every violation you found and fixed.',
].join('\n')

let round = synthesized
let audit = null
for (let i = 0; i < 3; i++) {
  audit = await agent(
    'You are the RULES AUDITOR on an artist\'s Oracle council. Default to finding problems.\n\nSITUATION:\n' + SITUATION + '\n\n' + RULES + '\n\n' + AUDIT_RULES + '\n\nROUND TO AUDIT:\n' + JSON.stringify(round) + '\n\nDo not edit files.',
    { label: 'audit-' + (i + 1), phase: 'Audit', schema: AUDIT_SCHEMA })
  if (!audit) break
  round = audit.round
  log('audit ' + (i + 1) + ': ' + (audit.clean ? 'clean' : audit.violations.length + ' violation(s) fixed'))
  if (audit.clean) break
}

return {
  round,
  auditClean: !!(audit && audit.clean),
  lastViolations: audit ? audit.violations : ['auditor returned nothing'],
  stats: { candidates: pool.length, keptByACritic: keepers.length, drafts: drafts.length },
  killedByBoth: pool.filter(c => !isKeeper(c)).map(c => ({ seer: c.seer, title: c.candidate.title, taste: c.taste && c.taste.doubt, reality: c.reality && c.reality.doubt })),
}
