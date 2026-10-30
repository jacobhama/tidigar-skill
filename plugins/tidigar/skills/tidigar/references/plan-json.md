# Tidigar plans as JSON

This is an optional format for scripts and new stored plans. To create or change a share link
directly, use [llms.txt](https://tidigar.com/llms.txt).

## Plan

```json
{
  "name": "Website launch",
  "dimensions": { "Team": ["Design", "Development"], "Phase": ["Plan", "Build"] },
  "activities": [
    {
      "title": "Requirements",
      "start": "2026-03-02",
      "end": "2026-03-13",
      "progress": 100,
      "values": { "Team": "Design", "Phase": "Plan" }
    },
    {
      "title": "Design",
      "start": "2026-03-16",
      "end": "2026-04-03",
      "progress": 50,
      "values": { "Team": "Design", "Phase": "Plan" },
      "dependsOn": ["Requirements"]
    },
    {
      "title": "Build",
      "start": "2026-03-26",
      "end": "2026-05-15",
      "values": { "Team": "Development", "Phase": "Build" },
      "dependsOn": ["Design"],
      "startAfter": [50]
    },
    {
      "title": "Test",
      "start": "2026-05-18",
      "end": "2026-05-29",
      "values": { "Team": "Development", "Phase": "Build" },
      "dependsOn": ["Build"]
    }
  ],
  "milestones": [{ "title": "Launch", "date": "2026-06-01", "dependsOn": ["Test"] }]
}
```

- Unknown fields are errors; owners, status and categories belong in `values`.
- `name` is required, 1–100 characters. Everything else is optional: `description`, `workDays`
  (`true` plans in work days), `dimensions`, `activities`, `milestones`, `periods` and `view`.
- Dates are `YYYY-MM-DD`. `end` is inclusive; left out, the activity lasts one day.
- `dimensions` maps a name to its options in order. An option is a name, or
  `{ "name": "Design", "color": "#4f7cff" }` for a stored plan; a link carries no colors. An
  activity's `values` names one option per dimension; an option no dimension lists is added.
- `dependsOn` names activities by title, or by 0-based index where titles repeat. Activities may
  also name fixed milestones by title.
- An activity’s `startAfter` is an array in the same order as `dependsOn`, for example
  `"dependsOn": ["Design", "Approval"], "startAfter": [50, 100]`. Values are `0`, `25`, `50`, `75`
  or `100`; missing entries mean `100`, and trailing `100` entries may be omitted. It cannot have
  more entries than `dependsOn`; fixed milestones require `100`. In the example, Design lasts 19
  calendar days, so Build starts on March 26, after `ceil(19 × 50 / 100) = 10` days.
- Builders preserve supplied dates. For a partial threshold, validation requires only that the
  successor does not start before the predecessor; it does not recalculate the work calendar. Choose
  dates that meet the intended threshold. Tidigar’s editor uses the exact threshold when scheduling.
- Titles are at most 180 characters; milestones and periods need one.
- `periods`: `{ "title", "start", "end", "vacation" }`, and `color` in a stored plan.
- `view`: `type` is `"timeline"`, `"grid"`, `"list"` or `"flow"`; `groupBy`, `colorBy`, `rows` and
  `columns` take a dimension's name; `start` and `end` set the timeline's range. `layout` is
  `"classic"`, one activity per row under a label column as in MS Project, or `"compact"`,
  activities sharing rows; `style` is `"minimal"`, `"airy"`, `"contrast"` or `"terminal"`. Left out,
  the link opens a timeline over the plan's dates, grouped and colored by the first dimension, and
  its board has the first dimension as rows and the second as columns.
- A link holds roughly 20–30 activities. If too large, shorten titles, drop descriptions or merge
  small activities and explain omissions. Never truncate a link.

## Build a link from JSON

`https://tidigar.com/agents/v1/tidigar-link.mjs` validates a plan with the code Tidigar itself uses
and writes its link, as one file for Node.js 20 or later, Deno or Bun. It runs entirely on your
machine.

```sh
curl -fSL -o tidigar-link.mjs https://tidigar.com/agents/v1/tidigar-link.mjs
node tidigar-link.mjs plan.json
```

It prints the link, a summary with real dates and the fragment's length. `-` reads the plan from
standard input. When the plan breaks a rule, it exits with an error that names the rule and the
record:

```text
Invalid activities[2] "Build".start: must be at least one day after dependency activities[1] "Design" ends
```

As a module: `import { createLink, readLink, embedCode } from './tidigar-link.mjs'`;
`createLink(plan)` returns `{ url, fragment, length, limit, summary }`.

## Python and reading links

The optional [Python builder](https://tidigar.com/agents/v1/tidigar_link.py) runs on Python 3.8 or
later, without extra packages or an internet connection once downloaded:

```sh
python3 tidigar_link.py plan.json
```

To edit a link through JSON instead of editing its records directly:

```sh
node tidigar-link.mjs --read "<link>" > plan.json
python3 tidigar_link.py --read "<link>" > plan.json
```

Edit the plan and run either builder again. `--read` reports any corrections made while reading; use
the JavaScript module's `--validate "<link>"` to check a finished link without rewriting it.
`--embed plan.json` prints iframe code. The
[plan schema](https://tidigar.com/agents/schema/plan-v1.json) describes the JSON fields;
cross-record rules are checked by Tidigar and the builders.
