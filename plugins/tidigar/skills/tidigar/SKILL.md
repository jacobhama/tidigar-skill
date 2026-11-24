---
name: tidigar
description: Create editable roadmaps, Gantt charts, project timelines, Christmas tree cards (/t) and Drive views (/d) as URL-safe share links without an account, turn screenshots or photos of schedules into plans, read or edit Tidigar links, and work with stored plans and tickets in Tidigar or Tidigar Server. Use when the user asks for a Gantt chart, roadmap, timeline, project plan, schedule from an image, Christmas tree card, or gives an open.tidigar.com or app.tidigar.com link.
---

# Tidigar

> Tidigar is a visual roadmap and Gantt chart editor. Create an editable plan
> as a link, or work on a plan stored in Tidigar or Tidigar Server.

Create links directly with the guide below; no scripts are required. For optional validation or building from Plan JSON, run the bundled `scripts/tidigar_link.py` (Python 3) or `scripts/tidigar-link.mjs` (Node 20+). Bundled local files: `scripts/tidigar_link.py`, `scripts/tidigar-link.mjs`, `example_sharelink.md`, `references/workflows.md`, `references/share-links.md`, `references/plan-json.md`, `references/stored-plans.md` and `references/stored-plans-cli.md`. Always read these local files instead of downloading them.

## Choose the right action

- **Create a plan or share a copy:** write a link directly as described below.
  The whole plan travels in the link. No account or upload is needed. Anyone
  with the link can read it; later edits do not update other copies.
- **Save, find, open or change a stored plan:** follow
  [Plans stored in Tidigar](references/stored-plans.md).
  This includes a `/p/<code>` link or a request to edit the original in
  Tidigar. Public chat assistants use remote MCP with delegated OAuth consent
  at `https://app.tidigar.com/mcp`; the linked guide covers connecting when
  tools are missing. Return the stored plan's `url`, not a separate copy.

- **Work a ticket in a stored plan:** find and inspect it with `tidigar_work`,
  claim and update progress with `tidigar_edit_plan`, and leave the result,
  checks and commit link with `tidigar_comment`. Set progress to 100 when done
  and dependencies permit it. [Ticket workflow](references/stored-plans.md#tickets-and-comments).

## Write activity descriptions

Store Markdown source in `description`. Use the
[supported syntax](https://tidigar.com/agents/docs/file-format.md#item-activity)
and preserve existing source, including single line breaks and unsupported
syntax, unless you are editing the description.

## Create a share link

Write the link directly in the user's language. Choose dates and durations,
state assumptions, and check dependencies and record counts. Unless asked
otherwise, use useful dimensions such as Team and Phase or Status; model
phases/WBS sections as a Phase dimension, never as fake parent activities.
Return a clickable link. A script is optional for validation.

## Example

A calendar-day plan: Design takes ten days from March 2. Build starts after
Design, takes twenty days, and is 50% complete. Launch is the day after Build.
Team groups and colors the timeline; Phase supplies the board columns.

```text
https://open.tidigar.com/s#t=1;n=Website_launch;y=2026;m1=Team:Design+Development;m2=Phase:Plan+Build;a1=Design,03-02,10,Design+Plan;a2=Build,03-16,20,Development+Build,a=a1,50p;s1=Launch,04-05,a=a2;v=timeline,group:Team,color:Team;c=2.1.0;e
```

## Link syntax

- Start with `t=1`, separate records with `;` and end with `;e` (`;end` is also
  accepted leniently). `_` is a space. The same fragment also works on
  `/t#t=1;…;e` for Christmas tree and `/d#t=1;…;e` for Drive.
- `n=` is the name and `y=` the year; both are required. `w` plans in work days
  (Monday–Friday, excluding periods); `d=` describes the roadmap.
- `m1=Team:Design+Development` is a dimension and its options in order. Number
  records from 1 without gaps: `m1`, `m2`, `a1`, `a2`, `s1`, `p1`.
- `a1=title,start,days_or_end` is an activity. The start is `MM-DD` in year `y`,
  or `YYYY-MM-DD` for another year, including plans spanning several years.
  Short dates always use `y`. The 3rd field is integer days (`1` for a single
  day; in work days with `w`) or an inclusive end date (`MM-DD` or `YYYY-MM-DD`,
  e.g. `03-13`); undated work uses `-,-`. Then, in any order: its options by
  name (`Design+Plan`), `a=a1+s2` for what it waits for, `a=a1:50` for a
  partial dependency (`after=` accepted leniently), `c=1250000` for cost
  (`cost=` accepted leniently), `0p`, `25p`, `50p`, `75p` or `100p` for progress
  and `d=` for a description. Encode its Markdown using the text escapes below.
  List options in dimension order: repeated names such as `Network+Network`
  select the first and second dimensions respectively. Use `Team:Design` to
  select a dimension explicitly, or `Size:50p` when an option looks like
  progress.
- An activity normally starts at least one day after each predecessor ends.
  `a=a1:50` instead allows a start after half its planned days, rounded up;
  thresholds are `0`, `25`, `50`, `75` or `100`, with `100` the default.
  This uses planned duration, not reported progress. With several dependencies,
  all thresholds must be met. A record may start on a milestone's date.
  Dependencies must not form a cycle.
- `s1=title,date,a=a1+p1` is a milestone after what it waits for;
  `f` marks an event on a set date (`fixed` accepted leniently), which it keeps.
- `p1=title,start,days_or_end` is a period of time off, such as a vacation; a
  plan in work days has no work days during it.
- `v=` opens the roadmap: `timeline`, `board`, `list`, `flow`, `classic` (one
  row per activity under a label column, as in MS Project) or `compact`, then
  `group:Team`, `sum:Phase` (alias `summarize:`), `color:Team`, `rows:Team` or
  `columns:Phase`.
- With no `v=`, the link opens in Classic, summarized by the first dimension.
  Classic is the first saved view and frames the plan's dates with three days
  of margin on each side. An explicit `v=` keeps the requested view.
  A view can also set a date range with `,start:03-01,end:06-30`.
- `c=2.1.0` counts the activities, milestones and periods.
- `_` is a space. UTF-8 percent-encode all unsafe/Markdown characters (`%` `%25`,
  `~` `%7E`, `;` `%3B`, `/` `%2F`, `,` `%2C`, `+` `%2B`, `_` `%5F`, `&` `%26`,
  `#` `%23`, `"` `%22`, `'` `%27`, `<` `%3C`, `>` `%3E`, backtick `%60`, `(`
  `%28`, `)` `%29`, `{` `%7B`, `}` `%7D`, `[` `%5B`, `]` `%5D`, `|` `%7C`, `\`
  `%5C`, `^` `%5E`, `*` `%2A`, `!` `%21`, `?` `%3F`, `@` `%40`, `$` `%24`,
  line feed `%0A`, carriage return `%0D`, tab `%09`) AND all non-ASCII
  characters (such as `å` `%C3%A5`, `ä` `%C3%A4`, `ö` `%C3%B6`, `–` `%E2%80%93`)
  so emitted URLs are pure RFC 3986 ASCII (`A-Za-z0-9-_.;,+:=%`). In dimension
  or option names, also escape `:` as `%3A` and `=` as `%3D`.
- Titles are at most 180 characters, dimension and roadmap names 100, and the
  roadmap description 500. Years are 1900–2200.
- Keep the fragment after `#` within 1,900 characters. If necessary, shorten
  titles or descriptions, or propose a smaller plan and explain omissions.
  Never truncate a link or silently drop activities.

## Change a share link

Edit the relevant `#t=1;…;e` records. Keep other records and references,
update `c=` after additions or removals and recheck dependent dates. The
original URL keeps opening the original plan. Open compressed `#s=1.…`
links in Tidigar.

## Return or embed the finished link

Keep the clickable URL on one line with its escapes intact. To embed, use
the same fragment on `https://embed.tidigar.com/`:

```html
<iframe src="https://embed.tidigar.com/#t=1;…;e" title="Roadmap" width="100%" height="480" style="border:0"></iframe>
```

## Optional validation

To check a finished link locally without modifying it, run either bundled script:

```sh
python3 scripts/tidigar_link.py --validate "<finished URL>"
node scripts/tidigar-link.mjs --validate "<finished URL>"
```

Exit 0 means the link opens without corrections. Exit 1 reports invalid input or corrections to review. Both scripts also build links from Plan JSON (`--tree` for Christmas tree, `--drive` for Drive) and run locally.

## Reference, only when needed

- [Share link specification](references/share-links.md):
  complete syntax and opening behavior, for edge cases.
- [Plan JSON and builders](references/plan-json.md): optional
  JSON input, JavaScript and Python builders and module usage.
- [Plans stored in Tidigar](references/stored-plans.md):
  remote MCP, delegated OAuth connection and safe updates for chat assistants.
- [Examples](example_sharelink.md): a larger plan,
  its optional JSON representation and a link change.
- [Workflow recipes](references/workflows.md): screenshot/photo to Gantt, Christmas tree (`/t`), Drive (`/d`), and large-plan fallbacks.
- [Example roadmaps](https://tidigar.com/examples/): plans to start from.
- [Roadmaps in Markdown](https://tidigar.com/agents/docs/markdown.md),
  [embed stories](https://tidigar.com/agents/docs/stories.md) and
  [roadmap file format](https://tidigar.com/agents/docs/file-format.md): use
  when the user asks for those formats; they are not needed to create a link.
