# Connectors

| Connector | Policy | Pauses on |
|---|---|---|
| GitHub | pause on writes | merges, file deletes, workflow runs, new repos |
| Vercel | pause on writes | new deployments, promotes and rollbacks, domain purchases, DNS and firewall edits, pausing projects |
| Supabase | pause on writes | raw SQL, migrations, edge function deploys, branch merges and resets, new or paused projects |
| Figma | open | nothing |
| Canva | open | nothing |
| Higgsfield | pause on writes | anything that spends credits or publishes: generations, upscales, presets, ad and short runs, site deploys, TikTok publishing |
| Shopify | pause on writes | product, collection, discount and inventory writes, raw GraphQL mutations, digital product publishing |

If a tool reports it needs sign-in, authorize that connector in your claude.ai connector settings. A session cannot do it.
