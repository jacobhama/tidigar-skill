---
name: tidigar
description: Make Tidigar roadmaps, Gantt charts and project timelines as share links that open as editable plans in Tidigar, read or change a Tidigar link, and save, read or change plans stored in Tidigar Business or Tidigar Server. Use when the user asks for a roadmap, timeline, Gantt chart or project plan in Tidigar, asks to save or change a plan in Tidigar, or gives a link to open.tidigar.com or app.tidigar.com.
---

# Tidigar

> Tidigar is a visual roadmap and Gantt chart editor. Help the user make a plan,
> share a copy, or work on a plan stored in Tidigar Business or Tidigar Server.

This skill includes the reference module as `scripts/tidigar-link.mjs`, the Python builder as `scripts/tidigar_link.py`, the examples as `example_sharelink.md` and the share link specification as `references/share-links.md`, beside this file. Run the module from there, such as `node scripts/tidigar-link.mjs plan.json`, or the builder with `python3 scripts/tidigar_link.py plan.json`, instead of downloading or copying them.

Use this when a user asks for a roadmap, timeline, Gantt chart or project plan
in Tidigar, or gives you a Tidigar link.

## Choose the right action

- **Make a new plan without saving it to Business:** create a share link with
  the quick start below. The whole plan travels in the link; no Tidigar account
  or plan upload is needed. Anyone with the link can read it. Later edits to the
  original do not update the copy.
- **Save, find, open or change a stored plan:** follow [Plans stored in
  Tidigar](#plans-stored-in-tidigar). Use this path for a `/p/<code>` plan link,
  and keep the existing plan's identity when updating it.
- **Give the user a link to a stored plan:** return that plan's `url`. Create a
  separate share-link copy only when they ask for a copy. If their intent is
  unclear, ask whether they want the shared plan or a separate copy.

For a share link, prefer the JavaScript or Python builder. If neither can run,
[write the link by hand](#write-a-link-by-hand).

## Quick start: create a plan and return its link

This guide and either builder are enough for a normal project plan, including
activities, dimensions, dependencies and milestones. You do not need to fetch
the share link specification, schemas or other documentation first. If a
reference page is unavailable, continue with this guide and a builder.

1. Choose the builder your tools can run:
   - **Node.js 20+, Deno or Bun:** download
     [tidigar-link.mjs](https://tidigar.com/agents/v1/tidigar-link.mjs), or use
     the copy included in the Tidigar skill. Run `node tidigar-link.mjs
     plan.json`.
   - **Python 3.8+:** download
     [tidigar_link.py](https://tidigar.com/agents/v1/tidigar_link.py). It needs
     no extra packages and, once downloaded, no internet access; the Tidigar
     skill includes a copy. Run `python3 tidigar_link.py plan.json`. In a
     notebook, run the file once, then `print(link(to_payload(plan)))`.
2. Write `plan.json` using the [plan example and fields below](#plan). Use the
   user's language for names and titles. Choose reasonable dates and durations
   when unspecified, and state those assumptions in your answer.
3. Unless the user says otherwise, give the plan at least two dimensions: first
   who does the work, such as Team, then where it stands, such as Phase or
   Status, with options in their order. The first groups the timeline and forms
   the board's rows; the second forms the board's columns.
4. Run the chosen builder. If it reports an error, fix the record it names and
   run it again.
5. Compare the printed summary with the request: check dates, activities,
   dimensions, dependencies and milestones.
6. Answer with the exact generated URL as a clickable Markdown link, followed by
   your date assumptions. The link opens the plan as an editable timeline in
   Tidigar.

If you cannot download or execute either builder, [write the link by
hand](#write-a-link-by-hand). State any verification you could not perform; do
not claim a link was tested unless you actually tested it.

Always give a builder's link exactly as it printed it. Never retype, shorten or
reflow a link: one lost character damages it.

## Rules

- Use only the plan fields described below. Owners, status and categories are
  dimensions, set through `values`.
- Prefer a builder. When neither can run, write the link by hand from the [share
  link specification](https://tidigar.com/agents/docs/share-links.md). If that
  reference is unavailable, give the plan as a fallback and say so.

## Write a link by hand

When no builder can run, write the link yourself, one record at a time.
Check each rule below; Tidigar corrects small mistakes and lists the rest.

```text
https://open.tidigar.com/s#t=1~n=Website_launch~y=2026~m1=Team:Design,Development~a1=Design/03-02/10/Design~a2=Build/03-16/20/Development/@a1/50p~s1=Launch/04-13/@a2~v=classic/color:Team~c=2.1.0~!
```

- Start with `t=1`, separate records with `~` and end with `~!`. `_` is a space.
- `n=` is the name and `y=` the year; both are required. `w` plans in work days,
  `d=` describes the roadmap.
- `m1=Team:Design,Development` is a dimension and its options in order. Number
  records from 1 without gaps: `m1`, `m2`, `a1`, `a2`, `s1`, `p1`.
- `a1=title/start/days` is an activity. The start is `MM-DD` in year `y`. Days
  counts its days, `1` for a single day; in work days with `w`. Then, in any
  order: its options by name (`Design,Plan`), `@a1,s2` for what it waits for,
  `@a1:50` to start once half of `a1` has passed, `50p` for progress and `d=`
  for a description.
- An activity starts after everything it waits for ends. Dependencies must not
  form a cycle.
- `s1=title/date/@a1` is a milestone at least one day after the activities it
  waits for; `s1=title/date/fixed` is an event on a set date that activities
  wait for with `@s1`.
- `p1=title/start/days` is a vacation period; add `/work` for a period that
  keeps its work days.
- `v=` opens the roadmap: `timeline`, `board`, `list`, `flow`, `classic` (one
  row per activity under a label column, as in MS Project) or `compact`, then
  `group:Team`, `color:Team`, `rows:Team` or `columns:Phase`.
- `c=2.1.0` counts the activities, milestones and periods.
- In text, write `/` as `%2F`, `~` as `%7E`, `_` as `%5F`, `%` as `%25`, `&` as
  `%26`, `#` as `%23`, `(` as `%28` and `)` as `%29`. In a dimension or option
  name, also `,` as `%2C` and `:` as `%3A`. Write å, ä, ö and other letters as
  they are.
- Keep the link under 1,900 characters after `#`.

## The model

A roadmap is a handful of records. Everything Tidigar shows is a view of them.

- **Activity**: a bar on the timeline. A title, a start date and an inclusive
  end date, with an optional description, progress (`0`, `25`, `50`, `75` or
  `100`) and one option per dimension.
- **Dimension**: a way to sort activities, such as Team, Phase or Status, with
  options in order; Tidigar colors them. Owners, status and categories are all
  dimensions; there are no other fields for them. Dimensions decide grouping,
  board rows and columns, colors and filters.
- **Dependency**: an activity normally starts at least one day after each
  activity it waits for ends (100%). Its optional `startAfter` chooses a
  threshold per dependency: `0`, `25`, `50`, `75` or `100` percent of the
  predecessor’s planned duration. At 0% they may start together; at 50% the
  successor may start after half the predecessor’s days have passed, rounded up.
  This is planned time, not the predecessor’s reported `progress`. Count work
  days when `workDays` is true, otherwise calendar days. With several
  dependencies, all thresholds must be met. Dependencies cannot form cycles.
  Milestones that wait for activities always wait for their end. An activity can
  also wait for a fixed milestone and start on its date; that dependency has no
  partial threshold. When an activity or a fixed milestone moves in Tidigar,
  what waits for it follows.
- **Milestone**: a titled single date, which can wait for activities. A fixed
  milestone (`"fixed": true`) is instead an event on a set date, such as a
  decision or a delivery: it waits for nothing, and activities name it by title
  in their `dependsOn`.
- **Period**: a titled band across the timeline, such as a holiday or a sprint.
  It is a vacation unless it says otherwise.
- **Work days**: a roadmap is planned in calendar days or in work days: Monday
  to Friday, without vacation periods. Dates are calendar dates either way.
- **View**: how the roadmap is shown. `timeline` is the Gantt chart, `grid` a
  board, `list` a table and `flow` the dependency chart, each arranged by
  dimensions. A link opens in one view.

You write records with real dates and names. Tidigar adds IDs, colors and view
settings.

Tidigar's own shared links are compressed (`#s=1.…`). Never read, change or
build one by hand; ask the user to open it in Tidigar.

## Share URL integrity

The output of the serializer is authoritative, and the whole roadmap lives in
the link. Treat the URL as an opaque value and return the exact URL it produced.

- Do not append query parameters or attribution parameters, and do not add UTM
  tracking.
- Do not URL-normalize it, or decode and re-encode it.
- Do not alter the fragment.

## Plan

```json
{
  "name": "Website launch",
  "dimensions": { "Team": ["Design", "Development"], "Phase": ["Plan", "Build"] },
  "activities": [
    { "title": "Requirements", "start": "2026-03-02", "end": "2026-03-13", "progress": 100, "values": { "Team": "Design", "Phase": "Plan" } },
    { "title": "Design", "start": "2026-03-16", "end": "2026-04-03", "progress": 50, "values": { "Team": "Design", "Phase": "Plan" }, "dependsOn": ["Requirements"] },
    { "title": "Build", "start": "2026-03-26", "end": "2026-05-15", "values": { "Team": "Development", "Phase": "Build" }, "dependsOn": ["Design"], "startAfter": [50] },
    { "title": "Test", "start": "2026-05-18", "end": "2026-05-29", "values": { "Team": "Development", "Phase": "Build" }, "dependsOn": ["Build"] }
  ],
  "milestones": [{ "title": "Launch", "date": "2026-06-01", "dependsOn": ["Test"] }]
}
```

- Unknown fields are errors; owners, status and categories belong in `values`.
- `name` is required, 1–100 characters. Everything else is optional:
  `description`, `workDays` (`true` plans in work days), `dimensions`,
  `activities`, `milestones`, `periods` and `view`.
- Dates are `YYYY-MM-DD`. `end` is inclusive; left out, the activity lasts one
  day.
- `dimensions` maps a name to its options in order. An option is a name, or `{
  "name": "Design", "color": "#4f7cff" }` for a stored plan; a link carries no
  colors. An activity's `values` names one option per dimension; an option no
  dimension lists is added.
- `dependsOn` names activities by title, or by 0-based index where titles
  repeat. Activities may also name fixed milestones by title.
- An activity’s `startAfter` is an array in the same order as `dependsOn`, for
  example `"dependsOn": ["Design", "Approval"], "startAfter": [50, 100]`. Values
  are `0`, `25`, `50`, `75` or `100`; missing entries mean `100`, and trailing
  `100` entries may be omitted. It cannot have more entries than `dependsOn`;
  fixed milestones require `100`. In the example, Design lasts 19 calendar days,
  so Build starts on March 26, after `ceil(19 × 50 / 100) = 10` days.
- Builders preserve supplied dates. For a partial threshold, validation requires
  only that the successor does not start before the predecessor; it does not
  recalculate the work calendar. Choose dates that meet the intended threshold.
  Tidigar’s editor uses the exact threshold when scheduling.
- Titles are at most 180 characters; milestones and periods need one.
- `periods`: `{ "title", "start", "end", "vacation" }`, and `color` in a stored
  plan.
- `view`: `type` is `"timeline"`, `"grid"`, `"list"` or `"flow"`; `groupBy`,
  `colorBy`, `rows` and `columns` take a dimension's name; `start` and `end` set
  the timeline's range. `layout` is `"classic"`, one activity per row under a
  label column as in MS Project, or `"compact"`, activities sharing rows;
  `style` is `"minimal"`, `"airy"`, `"contrast"` or `"terminal"`. Left out, the
  link opens a timeline over the plan's dates, grouped and colored by the first
  dimension, and its board has the first dimension as rows and the second as
  columns.
- A link holds roughly 20–30 activities. If too large, shorten titles, drop
  descriptions or merge small activities and explain omissions. Never truncate a
  link.

The example opens as a timeline grouped and colored by team, and its board has a
column per phase:

https://open.tidigar.com/s#t=1~n=Website_launch~y=2026~m1=Team:Design,Development~m2=Phase:Plan,Build~a1=Requirements/03-02/12/Design,Plan/100p~a2=Design/03-16/19/Design,Plan/@a1/50p~a3=Build/03-26/51/Development,Build/@a2:50~a4=Test/05-18/12/Development,Build/@a3~s1=Launch/06-01/@a4~v=timeline/color:Team/group:Team/start:03-02/end:06-01~c=4.1.0~!

## The reference module

`https://tidigar.com/agents/v1/tidigar-link.mjs` validates a plan with the code
Tidigar itself uses and writes its link, as one file for Node.js 20 or later,
Deno or Bun. It runs entirely on your machine.

```sh
curl -fSL -o tidigar-link.mjs https://tidigar.com/agents/v1/tidigar-link.mjs
node tidigar-link.mjs plan.json
```

It prints the link, a summary with real dates and the fragment's length. `-`
reads the plan from standard input. When the plan breaks a rule, it exits with
an error that names the rule and the record:

```text
Invalid activities[2] "Build".start: must be at least one day after dependency activities[1] "Design" ends
```

As a module: `import { createLink, readLink, embedCode } from
'./tidigar-link.mjs'`; `createLink(plan)` returns `{ url, fragment, length,
limit, summary }`.

## Change a link

Read the link as a plan, edit the plan and build a new link. The old link keeps
opening the old roadmap.

```sh
node tidigar-link.mjs --read "https://open.tidigar.com/s#t=1~…" > plan.json
python3 tidigar_link.py --read "https://open.tidigar.com/s#t=1~…" > plan.json
```

## Show it in the chat

Always give the clickable link. Where you can render HTML, you may also show the
roadmap; `node tidigar-link.mjs --embed plan.json` prints this frame:

```html
<iframe src="https://embed.tidigar.com/#t=1~…" title="Website launch" width="100%" height="480" style="border:0"></iframe>
```

## Plans stored in Tidigar

Tidigar Business and Tidigar Server keep plans for an organisation. Use this
section when the user asks to save, list, open or change a stored plan, or gives
a `/p/<code>` link. A link to that plan opens the shared plan; a share link
opens a separate copy. The code is not the plan's id: list the organisation's
plans and use the one whose `url` matches the link, ignoring anything after `?`
or `#`.

**A stored plan is not a share link.** Of everything above, only writing
`plan.json` for a new plan applies:

- You use the `tidigar` command or the HTTP API, never the link builders.
- A stored plan is a full project with IDs, colors and saved views, as in the
  [roadmap file format](https://tidigar.com/agents/docs/file-format.md), not a
  `plan.json`. You change it by editing that project, never by rebuilding it
  from a plan, which would lose its IDs and views.
- It is saved on a server and every member of the organisation sees your
  changes, often while they edit; a share link is stored nowhere.
- Its `url` opens it only for signed-in members and holds no roadmap data. Never
  decode it or build a share link from it.

Use the first mode that works:

1. **MCP:** your tools include `tidigar_get_plan`. The steps below map to the
   tools `tidigar_list_plans`, `tidigar_get_plan`, `tidigar_validate_plan`,
   `tidigar_create_plan` (`plan` or `project`, `newId`) `tidigar_update_plan`
   (`id`, `revision`, `project`, `merge`), `tidigar_resolve_merge` (`id`,
   `choices`), `tidigar_delete_plan` (`id`, `revision`), `tidigar_list_trash`
   and `tidigar_restore_plan` (`id`); errors carry the same codes.
2. **CLI:** `tidigar status` exits 0. It keeps the token in the system's
   credential store.
3. **HTTP:** `TIDIGAR_TOKEN` is set and you can make HTTPS requests; see [over
   HTTP](#stored-plans-over-http).
4. **None:** explain that you are not connected and have not read, saved or
   changed the stored plan. Point the user to [Connect your AI
   assistant](https://tidigar.com/agents/cloud). For CLI access, they create a
   token under **Account → Agent access** and run `tidigar login` themselves or
   set `TIDIGAR_TOKEN`. Never ask for the token in the chat, print it or write
   it to a file. Offer a share-link copy as an alternative for a new plan, but
   do not substitute it for a requested save or update.

With the CLI signed in, the user can add the MCP tools, for example `claude mcp
add tidigar -- tidigar mcp` (`tidigar mcp --read-only` offers no writes).

All modes use the same JSON and errors as the [public
API](https://tidigar.com/agents/docs/api.md).

- **New plan:** write `plan.json` as in [Plan](#plan), run `tidigar plans
  validate plan.json`, check its summary, then `tidigar plans create plan.json`.
  Answer with the plan's `url`, which opens it for signed-in members.
- **Change a plan:** `tidigar plans list` shows each `id`, also the end of its
  `url`. `tidigar plans get <plan-id> --out plan.json` saves its `revision` and
  `project`. Edit `project` per the roadmap file format, keeping IDs and giving
  new records new UUIDs, then `tidigar plans update plan.json --merge`.
- Someone may save the plan while you work. `--merge` then combines both changes
  and saves. Exit 5 with `merge_conflicts` means both changed the same things
  and nothing was saved: stdout lists each conflict with an `id`, what it is
  `about`, the `change`, and the `base`, `mine` and `latest` values. Tell the
  user each conflict in plain words, ask which to keep, and never choose for
  them. Then run `tidigar plans resolve <mergeFile> --choices
  '{"c1":"mine","c2":"latest"}'` with an answer for every conflict. If it lists
  new conflicts, ask about those the same way.
- Exit 5 with `stale_revision`: the plan changed and could not be merged. Get it
  again, show the user what changed, redo your edit and update again; never
  overwrite the other change.
- **Delete a plan** only when the user asks, and confirm first by its name.
  `tidigar plans get <plan-id>` gives its `revision`; `tidigar plans delete
  <plan-id> --revision <n>` moves it to the trash, where it stays 30 days. Exit
  5 with `stale_revision`: someone changed it since; get it again and ask again.
  `tidigar plans trash` lists deleted plans and `tidigar plans restore
  <plan-id>` brings one back.
- **Screens:** a screen shows one saved view of a stored plan to anyone with its
  link, on a wall screen or a web page, and may play a story written in the
  [story language](https://tidigar.com/agents/docs/stories.md) with the plan's
  own titles and dates. `tidigar screens list <plan-id>` lists them. `tidigar
  screens create <plan-id> --view <view-id> --name <name> --story story.txt`
  makes one, `--name` and `--story` optional; ask the user first, since anyone
  with its link sees that view. `tidigar screens update <plan-id> <screen-id>`
  changes its `--story` file, `--name` or `--join-code on|off`. To change what a
  screen shows, update its saved view in the project and keep the view's `id`:
  deleting the view ends the screen. `tidigar screens link <plan-id>
  <screen-id>` prints its `url`; give it only to the user, never write it into a
  plan, a file or a public place. `tidigar screens delete <plan-id> <screen-id>`
  ends the link for good; confirm first. Exit 3 with `agent_screens_off`: the
  owners keep making screens and reading links to people.
- **A plan's history as a story:** when the user gives you the versions of a
  schedule, such as screenshots of the Gantt chart shown at each status meeting,
  store the latest version as the plan and write a story that replays the
  versions on a screen. Read every version first and match activities across
  them by meaning, not only by title. At `0:00`, set the plan to the first
  version without animation: `hide` what came later, `update` dates, progress
  and earlier titles, `add` what was dropped later, and `today("YYYY-MM-DD")`
  for the first meeting. Then give each later meeting one moment four to six
  seconds apart: its `today`, its changes (`changeDates`, `update`, `show`,
  `remove`) and a `caption` saying what changed and why if the slides say. End
  on the stored plan and `loop()`. The pattern is under "A plan's history" in
  the story language. Creating or updating the screen answers `storyWarnings`:
  each call a reader's screen would skip, by line. Fix them and update the story
  until the list is empty, then give the user the screen's link.
- Exit 7 (`write_unknown`): the write may or may not be saved. Get the plan and
  report what it holds; never repeat a write blindly.
- Exit 2: ask the user to run `tidigar login`. Exit 3: read-only token, viewer
  or no subscription. Exit 4: no such plan. Exit 5 with `plan_exists`: it
  already exists; `--new-id` saves a copy if the user wants one. Exit 6: too
  large.

### Stored plans over HTTP

The token stays in the environment, never in a command, output or the chat.
`TIDIGAR_SERVER` names a Tidigar Server.

```sh
API="${TIDIGAR_SERVER:-https://app.tidigar.com}/api/v1"
AUTH="Authorization: Bearer $TIDIGAR_TOKEN"
JSON="Content-Type: application/json"
curl -sS -H "$AUTH" "$API/token"
curl -sS -H "$AUTH" "$API/organizations/$ORG/plans"
curl -sS -X POST -H "$AUTH" -H "$JSON" --data-binary @body.json "$API/organizations/$ORG/plans/validate"
curl -sS -X POST -H "$AUTH" -H "$JSON" --data-binary @body.json "$API/organizations/$ORG/plans"
curl -sS -H "$AUTH" "$API/organizations/$ORG/plans/$PLAN_ID"
curl -sS -X PUT -H "$AUTH" -H "$JSON" -H "If-Match: \"$REVISION\"" --data-binary @body.json "$API/organizations/$ORG/plans/$PLAN_ID"
curl -sS -X POST -H "$AUTH" -H "$JSON" --data-binary @merge.json "$API/organizations/$ORG/plans/$PLAN_ID/merge"
curl -sS -X DELETE -H "$AUTH" -H "If-Match: \"$REVISION\"" "$API/organizations/$ORG/plans/$PLAN_ID"
curl -sS -H "$AUTH" "$API/organizations/$ORG/trash"
curl -sS -X POST -H "$AUTH" "$API/organizations/$ORG/trash/$PLAN_ID/restore"
curl -sS -H "$AUTH" "$API/organizations/$ORG/plans/$PLAN_ID/screens"
curl -sS -X PATCH -H "$AUTH" -H "$JSON" --data-binary @screen.json "$API/organizations/$ORG/plans/$PLAN_ID/screens/$SCREEN_ID"
curl -sS -H "$AUTH" "$API/organizations/$ORG/plans/$PLAN_ID/screens/$SCREEN_ID/link"
```

- `GET /token`: `organization.id` is `ORG`; `writable` says whether you may
  save. `GET /organizations/:org/plans` lists plans.
- New plan: send `{ "plan": … }` to `POST /organizations/:org/plans/validate`,
  which answers `{ project, summary }`, then create with `{ "project": … }` to
  keep its ID.
- Change: `GET /organizations/:org/plans/:id`, edit `project`, and send `{
  "project": … }` to `PUT /organizations/:org/plans/:id` with the read
  `revision` as `REVISION`.
- Someone saved first (`stale_revision`): send `{ "base": REVISION, "project": …
  }` to `POST /organizations/:org/plans/:id/merge`, which combines both changes
  and saves. `merge_conflicts` lists `conflicts` as for the CLI, each with its
  own `id`: ask the user about each, then send the same body with `"choices": {
  "<id>": "mine" | "latest" }` for every conflict so far, until it saves.
- Delete, after the user confirms: `DELETE /organizations/:org/plans/:id` with
  the read `revision` as `REVISION` moves it to the trash for 30 days. `GET
  /organizations/:org/trash` lists deleted plans; `POST
  /organizations/:org/trash/:id/restore` brings one back.
- Errors are `{ "error": { "code", "message" } }`. `stale_revision` also carries
  the latest `plan`; if `merge` answers `no_such_revision`, redo your edit on
  it. After a lost answer, or `plan_exists` on a retried create, get the plan
  and compare before writing.

## More, when you need it

- [Examples](https://tidigar.com/agents/example_sharelink.md): a full request,
  plan, output and answer, and a change to a link.
- [llms-full.txt](https://tidigar.com/llms-full.txt): this file, the examples
  and the share link specification in one file. Read it instead of this file,
  not as well: it starts with this file word for word.

## Reference

You do not need any of these to make or change a link: the module and the Python
builder already follow every rule.

- [Share link specification](https://tidigar.com/agents/docs/share-links.md):
  every record and rule of a link. Read it in full before you write a link by
  hand.
- [Plan schema](https://tidigar.com/agents/schema/plan-v1.json): JSON Schema
  2020-12, for validation in your own code.
- [Example roadmaps](https://tidigar.com/examples/): ready-made plans to start
  from.

Other formats, only when the user asks for them and never to make a link:

- [Roadmaps in Markdown](https://tidigar.com/agents/docs/markdown.md): a roadmap
  as text, for a repository or a document.
- [Embed stories](https://tidigar.com/agents/docs/stories.md): timed changes
  with captions on an embedded roadmap, for animated demos.
- [Roadmap file format](https://tidigar.com/agents/docs/file-format.md): the
  full model with IDs, for Tidigar's JSON and `.tidigar` files.
