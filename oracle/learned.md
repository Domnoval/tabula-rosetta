# Learned

The running log of what the Oracle learned from the artist, newest first. The council reads it with `oracle/lens.md` before every council and every interview, and never asks again what is already answered here.

How entries get here: at the start of every council the Oracle collects the answers to its question from the Field page (answer signals not yet handled, and any Ask box message that answers the question), from the mod (`oracle/inbox.jsonl`, written by `/next a` to `/next d` and `/next answer`) and from chat (AskUserQuestion). It records each one here, and only then marks the page signals handled and empties the inbox. Things the artist says that change how the Oracle works land here too. When an entry changes a rule, `oracle/lens.md` gets a dated note and the entry says so.

Treat this repository as public, whatever its visibility. The tapped option goes in word for word; the artist's own words go in word for word only when they hold no personal context, otherwise as a paraphrase at a distance, marked as one (themes only: never people, their circumstances, causes or specifics). No customer personal data. Record what an answer changes, not the private details behind it.

Each entry: the date and the `questionId` (or a short title when there was no question), the question, the answer with where it came from (page, page Ask box, mod or chat), and what it changes. One entry per `questionId` per council. When a question got several answers, the latest one wins whole and is the answer here; the earlier ones go under "Before that", each with its time and source.

```
## <YYYY-MM-DD> · <questionId>
- **Question:** <the question as asked>
- **Answer:** <option> / "<the artist's words>" (page, page Ask box, mod or chat)
- **Before that:** <earlier answers to the same question, each with its time and source; leave the line out when there were none>
- **What it changes:** <the rule, path or judgment it moves; "Lens changed" when it did; or "nothing yet" and why>
```

When the words hold personal context, or the entry is a paraphrase for any other reason, the answer line reads `- **Answer (paraphrase):** <option, if one was tapped> / <the words at a distance> (<source>)`.

## Held questions

Questions a council kept for a later round, so they are not lost: date, the question, why it was held. The next council reads them and may ask one; once asked or answered, it leaves this list.

None held right now.

---

## 2026-10-09 · Done right the first time

- **Question:** none; said while the bridge to a new thread was being finished.
- **Answer:** "take your time do it correctly ... solid foundation done right the first time" (chat)
- **What it changes:** Verification comes before shipping, root causes before patches, and nothing half-built is presented as done. Lens changed: "How we work".

## 2026-10-08 · Treat the repo as public

- **Question:** none recorded here; settled in chat, with options.
- **Answer (paraphrase):** Keep this repository clean of personal context, in every file and every commit. (chat)
- **What it changes:** Personal context never goes into this repo, whatever its visibility: not in this log, the Lens, the field file, the bridge, the page or a commit message. Lens changed: ground rule 8.

## 2026-10-08 · Round 3 inputs

Five questions asked in chat before questions had ids. The answers set the brief for round 3.
- **Question:** What should happen next with the Oracle's paths? **Answer:** Fresh council, new rules (chat). **What it changes:** round 3 ran as the heavier council (critics, three judges, a rules audit).
- **Question:** Is a painting in progress right now? **Answer:** "Just finished" (chat). **What it changes:** Stop Me's premise is gone, and round 3 replaced it.
- **Question:** Is the painting you just finished for sale? **Answer (paraphrase):** No: it is spoken for. The details are private. (chat) **What it changes:** it is not inventory and no path is built on it. Lens changed: ground rule 9.
- **Question (paraphrase):** Can recent personal history be material for the work? **Answer:** Only at a distance (chat). **What it changes:** themes yes, specifics never. Lens changed: ground rule 8.
- **Question:** How much time can you give the work most weeks right now? **Answer:** Most days (chat). **What it changes:** paths can be real projects. Lens changed: "Returning, not starting over".

## 2026-10-08 · r2-paid

- **Question:** Has anyone ever paid you for your art, outside the Shopify store? Round 2 first asked it as half of a compound question (with whether a painting was on the easel), before questions had ids or options.
- **Answer (paraphrase):** Yes, a good amount: paintings and commissions. No option tapped. (page Ask box, 2026-10-08T17:39Z, signal `s8g9uzau09kjs7fz58fz`; the rest of that message is private context and stays out of the repo)
- **Also (chat, 2026-10-08, paraphrase):** Yes: sales were strong before a long pause and slowed during it. The details are private.
- **What it changes:** There are real buyers behind the money seat. Shopify shows no orders ever, so those sales happened outside the store, and its zero is not the measure of demand: a money path that re-warms people who already bought beats one that waits for strangers. The other half of the old question is answered by the same message: the painting that was in progress is finished, and it is not inventory, so Stop Me's premise is gone. No later council asks r2-paid again; it stays in `oracle/field.json` only until round 3 replaces `now`, and an answer to it from the page or the mod before then is read as a later answer to the same question. Its options ("Yes, often", "A few times", "Once or twice", "Never yet") came before the rule for concrete buckets and overlap, so no later question copies them. The signal is recorded here, so the next council only marks it handled. Lens unchanged.

## 2026-10-08 · Asks must be easy to answer

- **Question:** none; said while the Oracle was being built.
- **Answer (paraphrase):** If there is an ask, it should be easy to answer. (chat)
- **What it changes:** Questions now come with options, on the page, in the mod and in chat. One question per round, never compound, with a stable `questionId` and 2 to 4 `questionOptions`; the artist taps an option or types their own words. In chat every question goes through AskUserQuestion. Lens changed: "How we work" and ground rule 7.

## 2026-10-08 · No placation

- **Question:** none; said while the Oracle was being built.
- **Answer (paraphrase):** Placation, or calling something a good idea just because, is not fine. (chat)
- **What it changes:** Every path now carries a `doubt`: the strongest honest objection to it. Lens changed: ground rule 5.

## 2026-10-08 · One seat for money

- **Question:** none; said while the Oracle was being built.
- **Answer (paraphrase):** Let one thing float around money, not everything. (chat)
- **What it changes:** Money now gets one seat per round: exactly one path is the money bet (`isMoney: true`), and the other five are free of the money test. Lens changed: "Money gets one seat, not the whole table" and ground rule 4.
