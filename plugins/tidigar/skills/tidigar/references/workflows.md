# Tidigar workflow recipes

Short recipes for common roadmap tasks without a Tidigar account (using `#t=1;…;e` share links). For stored plans with MCP, see `references/stored-plans.md`.

## Screenshot or photo to Gantt chart

1. Inspect the image: identify the title, year/time span, section headers or swimlanes, real activities (start and end dates, progress if shown), milestones, and dependency arrows.
2. Model phases, stages, or WBS headings as a **Phase** dimension in reading order — never as fake parent/summary activities. Use a second dimension (such as `Team` or `Workstream`) for orthogonal categories.
3. Put dates directly from the image using inclusive end dates (`a1=Design,03-02,03-13,Plan+Design`), so you do not need to count days by hand.
4. Wire real dependencies with `a=…` (including across phase boundaries).
5. Open in Classic with phase brackets: `v=timeline,classic,group:Phase,sum:Phase,color:Phase` (or `color:Team` when a second dimension exists).
6. Validate locally with `python3 scripts/tidigar_link.py --validate "<url>"` or `node scripts/tidigar-link.mjs --validate "<url>"` when a shell is available, and return the clickable URL on its own line.

## Christmas tree card and Drive links

Any `#t=1;…;e` fragment works on three openers:

- **Roadmap editor:** `https://open.tidigar.com/s#t=1;…;e`
- **Christmas tree card (3D lights):** `https://open.tidigar.com/t#t=1;…;e` (or `--tree` with `scripts/tidigar_link.py` / `scripts/tidigar-link.mjs`)
- **Drive (3D road):** `https://open.tidigar.com/d#t=1;…;e` (or `--drive` with the local builders)

## Plans larger than 1,900 characters

A share link fragment must stay within 1,900 characters (roughly 20–30 activities). When a plan does not fit:

1. Ask whether the user wants a concise high-level link (shorter titles, no descriptions, merged micro-tasks) — explain every omission and never truncate a link.
2. Or, if the assistant can create downloadable files, write a Tidigar Markdown file (see https://tidigar.com/agents/docs/markdown.md) that the user can drop directly into https://app.tidigar.com/.
