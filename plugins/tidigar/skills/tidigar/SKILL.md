---
name: tidigar
description: Make Tidigar roadmaps, Gantt charts and project timelines as share links that open as editable plans in Tidigar, and read or change a Tidigar link. Use when the user asks for a roadmap, timeline, Gantt chart or project plan in Tidigar, or gives a link to open.tidigar.com or app.tidigar.com.
---

# Tidigar

> Tidigar is a local-first roadmap and Gantt chart editor. An AI agent can turn a list of activities into a Tidigar share link: one clickable URL that carries the whole roadmap in its fragment and opens it as an editable timeline in the user's own Tidigar. No account, API key, backend or upload is involved, and nothing about the roadmap is stored on a server.

This skill includes the reference module as `scripts/tidigar-link.mjs`, the examples as `examples.md` and the share link specification as `references/share-links.md`, beside this file. Run the module from there, such as `node scripts/tidigar-link.mjs plan.json`, instead of downloading it.

Use this when a user asks for a Gantt chart, timeline, project plan or roadmap made with Tidigar, or gives you a Tidigar link to change. This file is all you need to make and change links. Your answer is always a clickable link, and building one needs code execution, because the roadmap is compressed into the link.

## The model

A roadmap is a handful of records. Everything Tidigar shows is a view of them.

- **Activity**: a bar on the timeline. A title, a start date and an inclusive end date, with an optional description, progress (`0`, `25`, `50`, `75` or `100`) and one option per dimension.
- **Dimension**: a way to sort activities, such as Team, Phase or Status, with options in order, each with a color. Owners, status and categories are all dimensions; there are no other fields for them. Dimensions decide grouping, board rows and columns, colors and filters.
- **Dependency**: an activity or a milestone waits for activities. It starts at least one day after each of them ends, and there are no cycles. An activity can also wait for a fixed milestone and start on its date. When an activity or a fixed milestone moves in Tidigar, what waits for it follows.
- **Milestone**: a titled single date, which can wait for activities. A fixed milestone (`"fixed": true`) is instead an event on a set date, such as a decision or a delivery: it waits for nothing, and activities name it by title in their `dependsOn`.
- **Period**: a titled band across the timeline, such as a holiday or a sprint. It is a vacation unless it says otherwise.
- **Work days**: a roadmap is planned in calendar days or in work days: Monday to Friday, without vacation periods. Dates are calendar dates either way.
- **View**: how the roadmap is shown. `timeline` is the Gantt chart, `grid` a board, `list` a table and `flow` the dependency chart, each arranged by dimensions. A link opens in one view.

You write records with real dates and names. Tidigar adds IDs, colors and view settings.

## Make a link

1. Work out the plan: activities with start and end dates, dimensions such as team or phase, dependencies and milestones. Tell the user which dates you assumed.
2. Write it as a plan: one JSON object, described below.
3. Run the reference module on it: `node tidigar-link.mjs plan.json`.
4. Compare the summary it prints against the request, and fix the plan if it differs.
5. Answer with the link, `https://open.tidigar.com/s#s=1.…`, as a clickable link.

Never write or alter the `s=1.…` text by hand. If you cannot run code, say so and do not invent a link: a made-up link does not open.

## Share URL integrity

The output of the serializer is authoritative, and the whole roadmap lives in the link. Treat the URL as an opaque value and return the exact URL it produced.

- Do not append query parameters or attribution parameters, and do not add UTM tracking.
- Do not URL-normalize it, or decode and re-encode it.
- Do not alter the fragment.

## Plan

```json
{
  "name": "Website launch",
  "dimensions": { "Team": ["Design", "Development"] },
  "activities": [
    { "title": "Requirements", "start": "2026-03-02", "end": "2026-03-13", "progress": 100, "values": { "Team": "Design" } },
    { "title": "Design", "start": "2026-03-16", "end": "2026-04-03", "progress": 50, "values": { "Team": "Design" }, "dependsOn": ["Requirements"] },
    { "title": "Build", "start": "2026-04-06", "end": "2026-05-15", "values": { "Team": "Development" }, "dependsOn": ["Design"] },
    { "title": "Test", "start": "2026-05-18", "end": "2026-05-29", "values": { "Team": "Development" }, "dependsOn": ["Build"] }
  ],
  "milestones": [{ "title": "Launch", "date": "2026-06-01", "dependsOn": ["Test"] }]
}
```

- `name` is required, 1–100 characters. Everything else is optional: `description`, `workDays` (`true` plans in work days), `dimensions`, `activities`, `milestones`, `periods` and `view`.
- Dates are `YYYY-MM-DD`. `end` is inclusive; left out, the activity lasts one day.
- `dimensions` maps a name to its options in order. An option is a name, or `{ "name": "Design", "color": "#4f7cff" }`. An activity's `values` names one option per dimension; an option no dimension lists is added.
- `dependsOn` names activities by title, or by 0-based index where titles repeat.
- Titles are at most 180 characters; milestones and periods need one.
- `periods`: `{ "title", "start", "end", "color", "vacation" }`.
- `view`: `type` is `"timeline"`, `"grid"`, `"list"` or `"flow"`; `groupBy`, `colorBy`, `rows` and `columns` take a dimension's name; `start` and `end` set the timeline's range. Left out, the link opens a timeline over the plan's dates, grouped and colored by the first dimension.
- A link holds roughly 20 to 30 activities. When a plan is too large, shorten descriptions and merge small activities, and tell the user what you left out. Never cut a link short.

The example opens as a timeline grouped and colored by team:

https://open.tidigar.com/s#s=1.RZDNTsMwEIRfBc15K9n5pTkiuHGCShysHEy6aS0ldomdIlT13XHcFCwfVv5mZ2d9gUWDD_70JvDDoGfbHUH4QZOJrCKMaJTCjvUIisUze3OwUVD0ddf3aGl5O_PgTiPbEIGsdF5otPEQTOp-46_ZTLwIPKgSJCUBJIUgJdubxc22Lkg-LqxMiJRI-Gk2wx60LSnfLjTCrL337tjHuTKvV9sVZimATwFe17VkKUnlCTg0F5wNf8ftgxl5MJZj-s4NbkIjCIfJzadU3fF70FOI8uVjNiLfiAz_8MXu_1C8EtfrLw

## The reference module

`https://tidigar.com/agents/v1/tidigar-link.mjs` is the code Tidigar itself uses to validate and encode links, as one file for Node.js 20 or later, Deno or Bun. It runs entirely on your machine.

```sh
curl -sO https://tidigar.com/agents/v1/tidigar-link.mjs
node tidigar-link.mjs plan.json
```

It prints the link, a summary with real dates and the fragment's length. `-` reads the plan from standard input. When the plan breaks a rule, it exits with an error that names the rule and the record:

```text
Invalid activities[2] "Build".start: must be at least one day after dependency activities[1] "Design" ends
```

As a module: `import { createLink, readLink, embedCode } from './tidigar-link.mjs'`; `createLink(plan)` returns `{ url, fragment, length, summary, payload }`.

## Change a link

Read the link as a plan, edit the plan and build a new link. The old link keeps opening the old roadmap.

```sh
node tidigar-link.mjs --read "https://open.tidigar.com/s#s=1.…" > plan.json
```

A plan leaves out a link's saved views and finer view settings, and the module says so when a link has them.

## Without the module

When you can run Python but cannot download the module, write the link's payload yourself and encode it below. Nothing validates it, so check every rule yourself. The payload is the plan in compact form:

- `n` name, `y` year, `d` description, `w` `1` for work days.
- Dates are whole days from January 1 of `y`: 2026-03-02 is `60`, `(date(2026, 3, 2) - date(2026, 1, 1)).days`.
- `m` dimensions: `[["Team", [["Design", "4f7cff"], ["Development", "16a34a"]]]]`, colors without `#`.
- `i` activities: `[title, start, length, description, progress, values, dependsOn]`, such as `["Build", 95, 39, "", 0, [2], [1]]`. `length` counts days after the start, so `0` is one day. `values` holds an option number per dimension, `1` for the first option and `0` for none. `dependsOn` holds 0-based activity indices; an index from the number of activities up is the milestone at that index minus the number of activities, which must be fixed. Trailing defaults may be left out.
- `s` milestones: `[title, date, dependsOn, fixed]`, `fixed` `1` for a fixed milestone with an empty `dependsOn`. `p` periods: `[title, start, length, color]`.
- `o` the view: `{ "view": "timeline", "color": 0, "group": 0 }`, where `color`, `group`, `row` and `col` take a dimension index.

```python
import base64, json, zlib

def tidigar_link(payload):
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = deflate.compress(data) + deflate.flush()
    fragment = "s=1." + base64.urlsafe_b64encode(packed).decode("ascii").rstrip("=")
    if len(fragment) > 1900:
        raise ValueError("The roadmap is too large for a share link.")
    return "https://open.tidigar.com/s#" + fragment
```

To read a link: `json.loads(zlib.decompress(base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)), -15))`, where `data` is the text after `s=1.`.

## Show it in the chat

Always give the clickable link. Where you can render HTML, you may also show the roadmap; `node tidigar-link.mjs --embed plan.json` prints this frame:

```html
<iframe src="https://embed.tidigar.com/#s=1.…" title="Website launch" width="100%" height="480" style="border:0"></iframe>
```

## More, when you need it

- [Examples](https://tidigar.com/agents/examples.md): a full request, plan, output and answer, and a change to a link.
- [llms-full.txt](https://tidigar.com/llms-full.txt): this file, the examples and the share link specification in one file. Read it instead of this file, not as well: it starts with this file word for word.

## Reference

You normally do not need these. They are complete specifications for tasks beyond making and changing a link.

- [Share link specification](https://tidigar.com/docs/share-links.md): every field and limit of the payload, including saved views and filters a plan cannot express.
- [Embed stories](https://tidigar.com/docs/stories.md): timed changes with captions that play on an embedded roadmap. Only for an animated demo or tutorial.
- [Roadmaps in Markdown](https://tidigar.com/docs/markdown.md): a roadmap as text, for a repository or a document.
- [Roadmap file format](https://tidigar.com/docs/file-format.md): the full model with IDs, for Tidigar's JSON and `.tidigar` files.
- [Plan schema](https://tidigar.com/schema/plan-v1.json) and [payload schema](https://tidigar.com/schema/share-link-v1.json): JSON Schema 2020-12, for validation in your own code.
- [Example roadmaps](https://tidigar.com/examples/): ready-made plans to start from.
