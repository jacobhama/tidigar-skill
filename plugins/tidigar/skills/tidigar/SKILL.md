---
name: tidigar
description: Make Tidigar roadmaps, Gantt charts and project timelines as share links that open as editable plans in Tidigar, read or change a Tidigar link, and save, read or change plans stored in Tidigar Business or Tidigar Server. Use when the user asks for a roadmap, timeline, Gantt chart or project plan in Tidigar, asks to save or change a plan in Tidigar, or gives a link to open.tidigar.com or app.tidigar.com.
---

# Tidigar

> Tidigar is a visual roadmap and Gantt chart editor. Create an editable plan
> as a link, or work on a plan stored in Tidigar Business or Tidigar Server.

Create links directly with the guide below; no scripts are required. For optional validation, use `node scripts/tidigar-link.mjs --validate "<finished URL>"`. The bundled files are `scripts/tidigar-link.mjs`, `scripts/tidigar_link.py`, `example_sharelink.md`, `references/share-links.md`, `references/plan-json.md`, `references/stored-plans.md` and `references/stored-plans-cli.md`. Use these local references instead of downloading them.

## Choose the right action

- **Create a plan or share a copy:** write a link directly as described below.
  The whole plan travels in the link. No account or upload is needed. Anyone
  with the link can read it; later edits do not update other copies.
- **Save, find, open or change a stored plan:** follow
  [Plans stored in Tidigar](https://tidigar.com/agents/stored-plans.md).
  This includes a `/p/<code>` link or a request to edit the original in
  Tidigar. Public chat assistants use remote MCP with delegated OAuth consent
  at `https://app.tidigar.com/mcp`; the linked guide covers connecting when
  tools are missing. Return the stored plan's `url`, not a separate copy.

## Create a share link

Write a clickable Tidigar link directly using the text format below. No tool
calls, scripts, downloads or account are required. This guide is enough for a
normal plan; additional references are optional. You may run a local script
to validate the finished link if you want.

1. Plan the activities, dates and dependencies in the user's language. Choose
   reasonable dates and durations when unspecified and state your assumptions.
2. Unless the user says otherwise, include two useful dimensions: who does the
   work, such as Team, and its Phase or Status. Owners and categories are also
   dimensions. Activities select one option per dimension.
3. Write the link one record at a time using the syntax below. Check dates,
   dependencies and record counts against the request.
4. Return it as a clickable Markdown link, such as `[Open the plan](URL)`,
   followed by your assumptions. Do not claim script or browser validation
   unless you performed it. Validation is optional; lack of tools is no reason
   to withhold the link.

## Example

A calendar-day plan: Design takes ten days from March 2. Build starts after
Design, takes twenty days, and is 50% complete. Launch is the day after Build.
Team groups and colors the timeline; Phase supplies the board columns.

```text
https://open.tidigar.com/s#t=1~n=Website_launch~y=2026~m1=Team:Design,Development~m2=Phase:Plan,Build~a1=Design/03-02/10/Design,Plan~a2=Build/03-16/20/Development,Build/@a1/50p~s1=Launch/04-05/@a2~v=timeline/group:Team/color:Team~c=2.1.0~!
```

## Link syntax

- Start with `t=1`, separate records with `~` and end with `~!`. `_` is a space.
- `n=` is the name and `y=` the year; both are required. `w` plans in work days
  (Monday–Friday, excluding vacation periods); `d=` describes the roadmap.
- `m1=Team:Design,Development` is a dimension and its options in order. Number
  records from 1 without gaps: `m1`, `m2`, `a1`, `a2`, `s1`, `p1`.
- `a1=title/start/days` is an activity. The start is `MM-DD` in year `y`,
  or `YYYY-MM-DD` for another year. Days counts its days, `1` for a single
  day; in work days with `w`. Then, in any order: its options by name
  (`Design,Plan`), `@a1,s2` for what it waits for, `@a1:50` for a partial
  dependency, `0p`, `25p`, `50p`, `75p` or `100p` for progress and `d=` for a
  description. Use `Team:Design` when option names repeat across dimensions,
  or `Size:50p` when an option looks like progress.
- An activity normally starts at least one day after each predecessor ends.
  `@a1:50` instead allows a start after half its planned days, rounded up;
  thresholds are `0`, `25`, `50`, `75` or `100`, with `100` the default.
  This uses planned duration, not reported progress. With several dependencies,
  all thresholds must be met. An activity may start on a fixed milestone's
  date. Dependencies must not form a cycle.
- `s1=title/date/@a1` is a milestone at least one day after the activities it
  waits for; `s1=title/date/fixed` is an event on a set date that activities
  wait for with `@s1`.
- `p1=title/start/days` is a vacation period; add `/work` for a period that
  keeps its work days.
- `v=` opens the roadmap: `timeline`, `board`, `list`, `flow`, `classic` (one
  row per activity under a label column, as in MS Project) or `compact`, then
  `group:Team`, `color:Team`, `rows:Team` or `columns:Phase`.
- With no `v=`, the link opens a timeline grouped and colored by the first
  dimension, with the first and second dimensions as board rows and columns.
  A view can also set a date range with `/start:03-01/end:06-30`.
- `c=2.1.0` counts the activities, milestones and periods.
- `_` is a space. In text, escape `/` as `%2F`, `~` as `%7E`, `_` as
  `%5F`, `%` as `%25`, `&` as `%26`, `#` as `%23`, `(` as `%28`, `)` as
  `%29`, `"` as `%22`, `<` as `%3C` and `>` as `%3E`. In dimension or option
  names, also escape `,` as `%2C`, `:` as `%3A`, `@` as `%40` and `=` as
  `%3D`. Write å, ä, ö and other letters as they are.
- Titles are at most 180 characters, dimension and roadmap names 100, and the
  roadmap description 500. Years are 1900–2200.
- Keep the fragment after `#` within 1,900 characters. If necessary, shorten
  titles or descriptions, or propose a smaller plan and explain omissions.
  Never truncate a link or silently drop activities.

## Change a share link

Read its `#t=1~…~!` records directly, change the relevant fields and return a
new link. Preserve the other records and references; update `c=` if records
are added or removed. When dates move, check the dependent activities and
milestones too. The old link keeps opening the old plan.

Tidigar's own compressed `#s=1.…` links are internal to the app's sharing
flow. Ask the user to open one in Tidigar; do not reconstruct it by hand.

## Return or embed the finished link

Keep the finished URL on one line. Preserve its fragment and text escaping;
do not append tracking parameters, shorten it or normalize it. These rules
apply when returning the finished link; you can edit its records to make a
new plan as described above.

Always provide a clickable link. Where HTML is supported, you may also embed
the same fragment at `https://embed.tidigar.com/#t=1~…~!`:

```html
<iframe src="https://embed.tidigar.com/#t=1~…~!" title="Roadmap" width="100%" height="480" style="border:0"></iframe>
```

## Optional validation

If you want to check a finished link with a script, download
[tidigar-link.mjs](https://tidigar.com/agents/v1/tidigar-link.mjs) and run it
locally with Node.js 20 or later:

```sh
node tidigar-link.mjs --validate "<finished URL>"
```

It prints dates, dependencies, record counts and fragment length, and reports
any corrections Tidigar would make. Exit 0 means it opens without corrections;
exit 1 means invalid input or corrections to review. Fix the original link and
check again if desired. It sends nothing anywhere. Tidigar also checks the
link when opened and reports any corrections or problems.

## Reference, only when needed

- [Share link specification](https://tidigar.com/agents/docs/share-links.md):
  complete syntax and opening behavior, for edge cases.
- [Plan JSON and builders](https://tidigar.com/agents/plan-json.md): optional
  JSON input, JavaScript and Python builders and module usage.
- [Plans stored in Tidigar](https://tidigar.com/agents/stored-plans.md):
  remote MCP, delegated OAuth connection and safe updates for chat assistants.
- [Examples](https://tidigar.com/agents/example_sharelink.md): a larger plan,
  its optional JSON representation and a link change.
- [llms-full.txt](https://tidigar.com/llms-full.txt): this guide and its
  references in one file; read it instead of fetching them separately.
- [Example roadmaps](https://tidigar.com/examples/): plans to start from.
- [Roadmaps in Markdown](https://tidigar.com/agents/docs/markdown.md),
  [embed stories](https://tidigar.com/agents/docs/stories.md) and
  [roadmap file format](https://tidigar.com/agents/docs/file-format.md): use
  when the user asks for those formats; they are not needed to create a link.
