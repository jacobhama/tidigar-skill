---
name: tidigar
description: Make Tidigar roadmaps, Gantt charts and project timelines as share links that open as editable plans in Tidigar, and read or change a Tidigar link. Use when the user asks for a roadmap, timeline, Gantt chart or project plan in Tidigar, or gives a link to open.tidigar.com or app.tidigar.com.
---

# Tidigar

> Tidigar is a local-first roadmap and Gantt chart editor. An AI agent can turn a list of activities into a Tidigar share link: one clickable URL that carries the whole roadmap in its fragment and opens it as an editable timeline in the user's own Tidigar. No account, API key, backend or upload is involved, and nothing about the roadmap is stored on a server.

This skill includes the reference module as `scripts/tidigar-link.mjs`, the Python builder as `scripts/tidigar_link.py`, the examples as `example_sharelink.md` and the share link specification as `references/share-links.md`, beside this file. Run the module from there, such as `node scripts/tidigar-link.mjs plan.json`, or the builder with `python3 scripts/tidigar_link.py plan.json`, instead of downloading or copying them.

Use this when a user asks for a Gantt chart, timeline, project plan or roadmap made with Tidigar, or gives you a Tidigar link to change. Creating a link needs code execution, because the roadmap is compressed into the link.

## Quick start: create a plan and return its link

This guide and either builder are enough for a normal project plan, including activities, dimensions, dependencies and milestones. You do not need to fetch the share link specification, schemas or other documentation first. If a reference page is unavailable, continue with this guide and a builder.

1. Choose the builder your tools can run:
   - **Node.js 20+, Deno or Bun:** download [tidigar-link.mjs](https://tidigar.com/agents/v1/tidigar-link.mjs), or use the copy included in the Tidigar skill. Run `node tidigar-link.mjs plan.json`.
   - **Python 3.8+:** download [tidigar_link.py](https://tidigar.com/agents/v1/tidigar_link.py). If downloading is unavailable, copy [the Python builder below](#the-python-builder) exactly into `tidigar_link.py`; it runs without internet access or extra packages. Run `python3 tidigar_link.py plan.json`. For a notebook, use the calls shown in that section.
2. Write `plan.json` using the [plan example and fields below](#plan). Use the user's language for names and titles. Choose reasonable dates and durations when unspecified, and state those assumptions in your answer.
3. Unless the user says otherwise, give the plan at least two dimensions: first who does the work, such as Team, then where it stands, such as Phase or Status, with options in their order. The first groups the timeline and forms the board's rows; the second forms the board's columns.
4. Run the chosen builder. If it reports an error, fix the record it names and run it again.
5. Compare the printed summary with the request: check dates, activities, dimensions, dependencies and milestones.
6. Answer with the exact generated URL as a clickable Markdown link, followed by your date assumptions. The link opens the plan as an editable timeline in Tidigar.

If you cannot run either builder, explain that limitation and give the plan as a fallback. Never invent a link or claim you verified one without running a builder.

## Rules

- Use only the plan fields described below. Owners, status and categories are dimensions, set through `values`.
- Only a builder writes the link, its `s=1.…` text, the compact payload, day offsets and option numbers.
- Read the [share link specification](https://tidigar.com/agents/docs/share-links.md) only when the request needs features the plan cannot express, such as saved views or filters. If that reference is unavailable, deliver the supported part and explain what you left out.

## The model

A roadmap is a handful of records. Everything Tidigar shows is a view of them.

- **Activity**: a bar on the timeline. A title, a start date and an inclusive end date, with an optional description, progress (`0`, `25`, `50`, `75` or `100`) and one option per dimension.
- **Dimension**: a way to sort activities, such as Team, Phase or Status, with options in order, each with a color. Owners, status and categories are all dimensions; there are no other fields for them. Dimensions decide grouping, board rows and columns, colors and filters.
- **Dependency**: an activity normally starts at least one day after each activity it waits for ends (100%). Its optional `startAfter` chooses a threshold per dependency: `0`, `25`, `50`, `75` or `100` percent of the predecessor’s planned duration. At 0% they may start together; at 50% the successor may start after half the predecessor’s days have passed, rounded up. This is planned time, not the predecessor’s reported `progress`. Count work days when `workDays` is true, otherwise calendar days. With several dependencies, all thresholds must be met. Dependencies cannot form cycles. Milestones that wait for activities always wait for their end. An activity can also wait for a fixed milestone and start on its date; that dependency has no partial threshold. When an activity or a fixed milestone moves in Tidigar, what waits for it follows.
- **Milestone**: a titled single date, which can wait for activities. A fixed milestone (`"fixed": true`) is instead an event on a set date, such as a decision or a delivery: it waits for nothing, and activities name it by title in their `dependsOn`.
- **Period**: a titled band across the timeline, such as a holiday or a sprint. It is a vacation unless it says otherwise.
- **Work days**: a roadmap is planned in calendar days or in work days: Monday to Friday, without vacation periods. Dates are calendar dates either way.
- **View**: how the roadmap is shown. `timeline` is the Gantt chart, `grid` a board, `list` a table and `flow` the dependency chart, each arranged by dimensions. A link opens in one view.

You write records with real dates and names. Tidigar adds IDs, colors and view settings.

## Share URL integrity

The output of the serializer is authoritative, and the whole roadmap lives in the link. Treat the URL as an opaque value and return the exact URL it produced.

- Do not append query parameters or attribution parameters, and do not add UTM tracking.
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
- `name` is required, 1–100 characters. Everything else is optional: `description`, `workDays` (`true` plans in work days), `dimensions`, `activities`, `milestones`, `periods` and `view`.
- Dates are `YYYY-MM-DD`. `end` is inclusive; left out, the activity lasts one day.
- `dimensions` maps a name to its options in order. An option is a name, or `{ "name": "Design", "color": "#4f7cff" }`. An activity's `values` names one option per dimension; an option no dimension lists is added.
- `dependsOn` names activities by title, or by 0-based index where titles repeat. Activities may also name fixed milestones by title.
- An activity’s `startAfter` is an array in the same order as `dependsOn`, for example `"dependsOn": ["Design", "Approval"], "startAfter": [50, 100]`. Values are `0`, `25`, `50`, `75` or `100`; missing entries mean `100`, and trailing `100` entries may be omitted. It cannot have more entries than `dependsOn`; fixed milestones require `100`. In the example, Design lasts 19 calendar days, so Build starts on March 26, after `ceil(19 × 50 / 100) = 10` days.
- Builders preserve supplied dates. For a partial threshold, validation requires only that the successor does not start before the predecessor; it does not recalculate the work calendar. Choose dates that meet the intended threshold. Tidigar’s editor uses the exact threshold when scheduling.
- Titles are at most 180 characters; milestones and periods need one.
- `periods`: `{ "title", "start", "end", "color", "vacation" }`.
- `view`: `type` is `"timeline"`, `"grid"`, `"list"` or `"flow"`; `groupBy`, `colorBy`, `rows` and `columns` take a dimension's name; `start` and `end` set the timeline's range. Left out, the link opens a timeline over the plan's dates, grouped and colored by the first dimension, and its board has the first dimension as rows and the second as columns.
- A link holds roughly 20–30 activities. If too large, shorten descriptions or merge small activities and explain omissions. Never truncate a link.

The example opens as a timeline grouped and colored by team, and its board has a column per phase:

https://open.tidigar.com/s#s=1.XZBNa8MwDIb_ytBZBdv5KjmO7bZD2Qo7BB-8VG0NjtPFScco_e-Tnaz7AB-En1d6X-kCHmp4pbdgR7pzZvLtERA-oVZClQgd1E0DWzIdIBcPFOzBsyDfV-1-Dxrj35lcf-rIjwxkabLcgNYRbY4mUGrcOPOv7X6ybvenQSPYZPdM75MdKE4MgKVAKREApRDYSJR6dp2TVDnKdaTFArER-tf8dR4Jc8YKFZMoKWbNlgJnllm1ONw0KqUJKc3TchRZSGyyBHqoL3C29MG3G21HznpeE9re9QPUbHcY-umUqm_8MpphZHk860pkK6HgBz763Q3xk3C9fgE

## The reference module

`https://tidigar.com/agents/v1/tidigar-link.mjs` is the code Tidigar itself uses to validate and encode links, as one file for Node.js 20 or later, Deno or Bun. It runs entirely on your machine.

```sh
curl -fSL -o tidigar-link.mjs https://tidigar.com/agents/v1/tidigar-link.mjs
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
python3 tidigar_link.py --read "https://open.tidigar.com/s#s=1.…" > plan.json
```

A plan leaves out a link's saved views and finer view settings, and the module says so when a link has them.

## Show it in the chat

Always give the clickable link. Where you can render HTML, you may also show the roadmap; `node tidigar-link.mjs --embed plan.json` prints this frame:

```html
<iframe src="https://embed.tidigar.com/#s=1.…" title="Website launch" width="100%" height="480" style="border:0"></iframe>
```

## More, when you need it

- [Examples](https://tidigar.com/agents/example_sharelink.md): a full request, plan, output and answer, and a change to a link.
- [llms-full.txt](https://tidigar.com/llms-full.txt): this file, the examples and the share link specification in one file. Read it instead of this file, not as well: it starts with this file word for word.

## Reference

You do not need any of these to make or change a link: the module and the Python builder already follow every rule.

- [Share link specification](https://tidigar.com/agents/docs/share-links.md): every field and limit of the payload. Read it in full before you write a payload yourself or need what a plan cannot express, such as saved views or filters.
- [Plan schema](https://tidigar.com/agents/schema/plan-v1.json) and [payload schema](https://tidigar.com/agents/schema/share-link-v1.json): JSON Schema 2020-12, for validation in your own code.
- [Example roadmaps](https://tidigar.com/examples/): ready-made plans to start from.

Other formats, only when the user asks for them and never to make a link:

- [Roadmaps in Markdown](https://tidigar.com/agents/docs/markdown.md): a roadmap as text, for a repository or a document.
- [Embed stories](https://tidigar.com/agents/docs/stories.md): timed changes with captions on an embedded roadmap, for animated demos.
- [Roadmap file format](https://tidigar.com/agents/docs/file-format.md): the full model with IDs, for Tidigar's JSON and `.tidigar` files.

## The Python builder

Skip this section when you use the reference module. When you can run Python but not the module, for example in a sandbox without internet access, save this code as `tidigar_link.py`, exactly as written, and run it on the plan. It checks the same rules as the module, builds the same link and prints the same summary, or an error that names the rule and the record. It needs only Python 3.8 or later. The same file is at `https://tidigar.com/agents/v1/tidigar_link.py`.

```sh
python3 tidigar_link.py plan.json
```

In a notebook, run the code once, then build from the plan as a Python dict: `payload = to_payload(plan)`, `print(link(payload))` and `print(summary(payload))`. `read(url)` returns a link's plan.

```python
"""Tidigar share links from plans, version 1: https://tidigar.com/llms.txt
python3 tidigar_link.py plan.json      build a link; - reads standard input
python3 tidigar_link.py --read LINK    print a link's roadmap as a plan"""
import base64, datetime, json, re, sys, zlib

OPENER = "https://open.tidigar.com/s"
COLORS = ["4f7cff", "16a34a", "f59e0b", "8a52c1", "0891b2", "dc5f5f", "64748b", "db2777"]
PERIOD_COLOR = "9aa7b5"
VIEW = {"type": "view", "groupBy": "group", "colorBy": "color", "rows": "row",
        "columns": "col", "start": "timelineStart", "end": "timelineEnd"}
KEYS = {"plan": ["$schema", "version", "name", "description", "workDays", "dimensions",
                 "activities", "milestones", "periods", "view"],
        "activity": ["title", "start", "end", "description", "progress", "values", "dependsOn", "startAfter"],
        "milestone": ["title", "date", "dependsOn", "fixed"],
        "period": ["title", "start", "end", "color", "vacation"],
        "option": ["name", "color"], "view": list(VIEW)}


def fail(path, message):
    raise ValueError(f"Invalid {path}: {message}")


def q(text):
    return json.dumps(text, ensure_ascii=False)


def named(path, record):
    title = record.get("title") if isinstance(record, dict) else None
    if isinstance(title, str) and len(title) > 40:
        title = title[:40] + "…"
    return f"{path} {q(title)}" if isinstance(title, str) and title else path


def record(value, path, kind):
    if not isinstance(value, dict):
        fail(path, "expected an object")
    for key in value:
        if key not in KEYS[kind]:
            hint = '. Dimension options go in values, such as "values": { "Team": "Design" }'
            fail(f"{path}.{key}", "unknown field; use " + ", ".join(KEYS[kind]) + (hint if kind == "activity" else ""))
    return value


def items(value, path):
    if value is None:
        return []
    if not isinstance(value, list):
        fail(path, "expected an array")
    return value


def text(value, path, limit, required=False):
    if not isinstance(value, str):
        fail(path, "expected text")
    if required and not value.strip():
        fail(path, "must not be empty")
    if len(value.encode("utf-16-le")) // 2 > limit:
        fail(path, f"at most {limit} characters")
    return value


def day(value, path):
    try:
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) and "1900" <= value <= "2200-12-31"
        return datetime.date.fromisoformat(value).toordinal()
    except (AssertionError, TypeError, ValueError):
        fail(path, "expected a date as YYYY-MM-DD")


def iso(ordinal):
    return datetime.date.fromordinal(ordinal).isoformat()


def flag(value, path):
    if value is not None and not isinstance(value, bool):
        fail(path, "expected true or false")
    return value


def color(value, path):
    if not isinstance(value, str) or not re.fullmatch(r"#?[0-9a-fA-F]{6}", value):
        fail(path, "expected a color as #rrggbb")
    return value.lstrip("#").lower()


def to_payload(plan):
    """A plan's share-link payload, after checking every rule a link must meet."""
    record(plan, "plan", "plan")
    if plan.get("version", 1) != 1:
        fail("version", "must be 1")
    name = text(plan.get("name"), "name", 100, True)
    dims = {}  # dimension name -> [[option, color], ...], in order

    def dimension(key, path):
        if key not in dims:
            if not key.strip() or len(dims) == 20:
                fail(path, "a dimension needs a name; at most 20 dimensions")
            dims[key] = []
        return dims[key]

    def add(options, option, shade, path):
        text(option, path, 100)
        if any(known == option for known, _ in options):
            fail(path, f"{q(option)} is listed twice")
        if len(options) == 100:
            fail(path, "at most 100 options")
        options.append([option, shade or COLORS[len(options) % len(COLORS)]])

    if not isinstance(plan.get("dimensions", {}), dict):
        fail("dimensions", "expected an object of name -> options")
    for key, options in plan.get("dimensions", {}).items():
        path = f"dimensions.{q(key)}"
        for index, option in enumerate(items(options, path)):
            at = f"{path}[{index}]"
            if isinstance(option, str):
                add(dimension(key, path), option, None, at)
            else:
                record(option, at, "option")
                shade = color(option["color"], f"{at}.color") if "color" in option else None
                add(dimension(key, path), option.get("name"), shade, f"{at}.name")
        dimension(key, path)

    acts = [record(a, named(f"activities[{i}]", a), "activity")
            for i, a in enumerate(items(plan.get("activities"), "activities"))]
    points = [record(m, named(f"milestones[{i}]", m), "milestone")
              for i, m in enumerate(items(plan.get("milestones"), "milestones"))]
    titles, fixed = {}, {}
    for i, a in enumerate(acts):
        if isinstance(a.get("title"), str):
            titles[a["title"]] = -1 if a["title"] in titles else i
    for i, m in enumerate(points):
        if m.get("fixed") is True and isinstance(m.get("title"), str):
            fixed[m["title"]] = -1 if m["title"] in fixed else i

    def depends(value, path, milestone_ok):
        found = []
        for position, ref in enumerate(items(value, path)):
            at = f"{path}[{position}]"
            if isinstance(ref, int) and not isinstance(ref, bool):
                if not 0 <= ref < len(acts):
                    fail(at, f"there is no activities[{ref}]")
                index = ref
            elif not isinstance(ref, str):
                fail(at, "expected an activity title or index")
            elif ref not in titles and milestone_ok and ref in fixed:
                if fixed[ref] < 0:
                    fail(at, f"several fixed milestones are titled {q(ref)}")
                index = len(acts) + fixed[ref]
            elif ref not in titles:
                fail(at, f"no activity{' or fixed milestone' if milestone_ok and fixed else ''} is titled {q(ref)}")
            elif titles[ref] < 0:
                fail(at, f"several activities are titled {q(ref)}; use an index")
            else:
                index = titles[ref]
            if index in found:
                fail(at, "duplicate dependency")
            found.append(index)
        return found

    dated, rows, marks, bands = [], [], [], []
    for i, a in enumerate(acts):
        path = named(f"activities[{i}]", a)
        start = day(a.get("start"), f"{path}.start")
        end = day(a["end"], f"{path}.end") if "end" in a else start
        if end < start:
            fail(f"{path}.end", "must not be before start")
        progress = a.get("progress", 0)
        if progress not in (0, 25, 50, 75, 100) or isinstance(progress, bool):
            fail(f"{path}.progress", "must be one of 0, 25, 50, 75, or 100")
        values = {}
        if not isinstance(a.get("values", {}), dict):
            fail(f"{path}.values", "expected dimension -> option")
        for key, option in a.get("values", {}).items():
            at = f"{path}.values.{q(key)}"
            options = dimension(key, at)
            if option is None or option == "":
                continue
            if option not in [known for known, _ in options]:
                add(options, option, None, at)
            values[list(dims).index(key)] = [known for known, _ in options].index(option) + 1
        dep = depends(a.get("dependsOn"), f"{path}.dependsOn", True)
        shares = a.get("startAfter", [])
        if not isinstance(shares, list):
            fail(f"{path}.startAfter", "expected an array")
        shares = shares[:]
        if len(shares) > len(dep):
            fail(f"{path}.startAfter", "must not have more entries than dependsOn")
        for position, share in enumerate(shares):
            if isinstance(share, bool) or share not in (0, 25, 50, 75, 100):
                fail(f"{path}.startAfter[{position}]", "must be one of 0, 25, 50, 75, or 100")
            if share != 100 and dep[position] >= len(acts):
                fail(f"{path}.startAfter[{position}]", "a fixed milestone requires 100")
        while shares and shares[-1] == 100:
            shares.pop()
        dated += [start, end]
        rows.append([text(a.get("title", ""), f"{path}.title", 180), start, end - start,
                     text(a.get("description", ""), f"{path}.description", 10**6), progress,
                     values, dep, path, shares])
    for i, m in enumerate(points):
        path = named(f"milestones[{i}]", m)
        date = day(m.get("date"), f"{path}.date")
        if flag(m.get("fixed"), f"{path}.fixed") and items(m.get("dependsOn"), path):
            fail(f"{path}.dependsOn", "a fixed milestone waits for nothing")
        dated.append(date)
        marks.append([text(m.get("title"), f"{path}.title", 180, True), date,
                      depends(m.get("dependsOn"), f"{path}.dependsOn", False),
                      1 if m.get("fixed") else 0, path])
    for i, p in enumerate(items(plan.get("periods"), "periods")):
        path = named(f"periods[{i}]", p)
        record(p, path, "period")
        start = day(p.get("start"), f"{path}.start")
        end = day(p["end"], f"{path}.end") if "end" in p else start
        if end < start:
            fail(f"{path}.end", "must not be before start")
        dated += [start, end]
        bands.append([text(p.get("title"), f"{path}.title", 180, True), start, end - start,
                      color(p["color"], f"{path}.color") if "color" in p else PERIOD_COLOR,
                      0 if flag(p.get("vacation"), f"{path}.vacation") is False else 1])
    flag(plan.get("workDays"), "workDays")

    # Partial dependencies permit overlap, so date ordering alone cannot rule out cycles.
    visiting, visited = set(), set()
    def visit(index):
        if index in visiting:
            fail(f"{rows[index][7]}.dependsOn", "dependency cycle")
        if index in visited:
            return
        visiting.add(index)
        for parent in rows[index][6]:
            if parent < len(rows):
                visit(parent)
        visiting.remove(index)
        visited.add(index)
    for index in range(len(rows)):
        visit(index)

    # Stored dates are preserved; partial dependencies cannot precede the parent's start.
    for row in rows:
        for position, index in enumerate(row[6]):
            if index >= len(rows):
                mark = marks[index - len(rows)]
                if row[1] < mark[1]:
                    fail(f"{row[7]}.start", f"must not be before fixed milestone {mark[4]}")
            elif position < len(row[8]) and row[8][position] < 100:
                if row[1] < rows[index][1]:
                    fail(f"{row[7]}.start", f"must not be before dependency {rows[index][7]} starts")
            elif row[1] <= rows[index][1] + rows[index][2]:
                fail(f"{row[7]}.start", f"must be at least one day after dependency {rows[index][7]} ends")
    for mark in marks:
        for index in mark[2]:
            if mark[1] <= rows[index][1] + rows[index][2]:
                fail(f"{mark[4]}.date", f"must be at least one day after dependency {rows[index][7]} ends")

    year = datetime.date.fromordinal(min(dated)).year if dated else datetime.date.today().year
    base = datetime.date(year, 1, 1).toordinal()

    def trim(values, defaults):
        while values and values[-1] == defaults[len(values) - 1]:
            values.pop()
        return values

    payload = {"n": name, "y": year,
               "c": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    if "description" in plan:
        payload["d"] = text(plan["description"], "description", 500)
    if plan.get("workDays"):
        payload["w"] = 1
    if dims:
        payload["m"] = [[key, options] for key, options in dims.items()]
    if rows:
        payload["i"] = [trim([t, s - base, n, d, pr, [v.get(k, 0) for k in range(max(v, default=-1) + 1)], dep, shares],
                             [None, None, None, "", 0, [], [], []]) for t, s, n, d, pr, v, dep, _, shares in rows]
    if marks:
        payload["s"] = [trim([t, d - base, dep, f], [None, None, [], 0]) for t, d, dep, f, _ in marks]
    if bands:
        payload["p"] = [trim([t, s - base, n, c, v], [None] * 4 + [1]) for t, s, n, c, v in bands]

    view = record(plan.get("view", {}), "view", "view")
    o = {}
    for key, field in VIEW.items():
        if key not in view:
            continue
        value = view[key]
        if key == "type":
            if value not in ("timeline", "grid", "list", "flow"):
                fail("view.type", "must be timeline, grid, list, flow")
            o["view"] = value
        elif key in ("start", "end"):
            o[field] = iso(day(value, f"view.{key}"))
        elif value is None or value == "":
            o[field] = ""
        elif value not in dims:
            fail(f"view.{key}", f"there is no dimension {q(value)}")
        else:
            o[field] = list(dims).index(value)
    o.setdefault("view", "timeline")
    if dims:
        if o["view"] == "grid":
            o.setdefault("row", 0)
            if len(dims) > 1:
                o.setdefault("col", 1)
        o.setdefault("color", 0)
        if o["view"] == "timeline":
            o.setdefault("group", 0)
    if dated:
        o.setdefault("timelineStart", iso(min(dated)))
        o.setdefault("timelineEnd", iso(max(dated)))
        if o["timelineEnd"] < o["timelineStart"]:
            fail("view.end", "must not be before view.start")
    payload["o"] = o
    return payload


def link(payload):
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
    fragment = "s=1." + base64.urlsafe_b64encode(deflate.compress(data) + deflate.flush()).decode().rstrip("=")
    if len(fragment) > 1900:
        raise ValueError(f"The roadmap is too large for a share link. It needs {len(fragment)} of 1900 characters; "
                         "shorten or drop descriptions and merge small activities.")
    return f"{OPENER}#{fragment}"


def read(url):
    """A link's roadmap as a plan, to change and build again. Saved views are left out."""
    data = url.split("#", 1)[-1].split("s=1.", 1)[1]
    payload = json.loads(zlib.decompress(base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)), -15))
    base = datetime.date(payload["y"], 1, 1).toordinal()
    dims, rows, marks = payload.get("m", []), payload.get("i", []), payload.get("s", [])
    titles = [row[0] if row else "" for row in rows]

    def ref(index):
        if index >= len(rows):
            return marks[index - len(rows)][0]
        return titles[index] if titles[index] and titles.count(titles[index]) == 1 else index

    plan = {"version": 1, "name": payload["n"]}
    if payload.get("d"):
        plan["description"] = payload["d"]
    if payload.get("w") == 1:
        plan["workDays"] = True
    if dims:
        plan["dimensions"] = {key: [o if c == COLORS[i % len(COLORS)] else {"name": o, "color": "#" + c}
                                    for i, (o, c) in enumerate(options)] for key, options in dims}
    if rows:
        plan["activities"] = []
        for row in rows:
            title, start, length, description, progress, values, after = (row + ["", 0, 0, "", 0, [], []][len(row):])[:7]
            activity = {"title": title, "start": iso(base + start), "end": iso(base + start + length)}
            if description:
                activity["description"] = description
            if progress:
                activity["progress"] = progress
            chosen = {dims[k][0]: dims[k][1][v - 1][0] for k, v in enumerate(values) if v}
            if chosen:
                activity["values"] = chosen
            if after:
                activity["dependsOn"] = [ref(index) for index in after]
            if len(row) > 7 and row[7]:
                activity["startAfter"] = row[7]
            plan["activities"].append(activity)
    if marks:
        plan["milestones"] = [dict({"title": m[0], "date": iso(base + m[1])},
                                   **({"dependsOn": [ref(x) for x in m[2]]} if m[2:3] and m[2] else {}),
                                   **({"fixed": True} if m[3:] == [1] else {})) for m in marks]
    if payload.get("p"):
        plan["periods"] = [dict({"title": p[0], "start": iso(base + p[1]), "end": iso(base + p[1] + p[2])},
                                **({"color": "#" + p[3]} if p[3] != PERIOD_COLOR else {}),
                                **({"vacation": False} if p[4:] == [0] else {})) for p in payload["p"]]
    view, o = {}, payload.get("o", {})
    for key, field in VIEW.items():
        if field in o:
            value = o[field]
            view[key] = value if key in ("type", "start", "end") else (dims[value][0] if value != "" else None)
    if view:
        view.setdefault("type", "grid")
        plan["view"] = view
    return plan


def summary(payload):
    """What the link holds, with real dates, to check against the request."""
    base = datetime.date(payload["y"], 1, 1).toordinal()
    rows, marks, dims = payload.get("i", []), payload.get("s", []), payload.get("m", [])
    place = lambda index: f"activities[{index}]" if index < len(rows) else f"milestones[{index - len(rows)}]"
    def after(refs, shares=()):
        return (" · after " + ", ".join(place(ref) + (f" ({shares[i]}%)" if i < len(shares) and shares[i] < 100 else "")
                                       for i, ref in enumerate(refs))) if refs else ""
    lines = [f"{payload['n']} ({payload['y']}{', work days' if payload.get('w') else ''})"]
    for i, row in enumerate(rows):
        row = row + ["", 0, 0, "", 0, [], []][len(row):]
        lines.append(f"activities[{i}] {row[0] or '(untitled)'}: {iso(base + row[1])} – {iso(base + row[1] + row[2])}"
                     + (f" · {row[4]}% done" if row[4] else "")
                     + "".join(f" · {dims[k][0]}: {dims[k][1][v - 1][0]}" for k, v in enumerate(row[5]) if v)
                     + after(row[6], row[7] if len(row) > 7 else []))
    for i, m in enumerate(marks):
        lines.append(f"milestones[{i}] {m[0]}: {iso(base + m[1])}" + (" · fixed" if m[3:] == [1] else "")
                     + after(m[2] if len(m) > 2 else []))
    for i, p in enumerate(payload.get("p", [])):
        lines.append(f"periods[{i}] {p[0]}: {iso(base + p[1])} – {iso(base + p[1] + p[2])}")
    return "\n".join(lines)


if __name__ == "__main__" and "ipykernel" not in sys.modules:
    args = sys.argv[1:]
    if args[:1] == ["--read"]:
        print(json.dumps(read(args[1]), ensure_ascii=False, indent=2))
    else:
        source = sys.stdin if args[:1] in ([], ["-"]) else open(args[0], encoding="utf-8")
        plan = json.load(source)
        try:
            payload = to_payload(plan)
            url = link(payload)
        except ValueError as error:
            sys.exit(str(error))
        print(url + "\n\n" + summary(payload) + f"\n\nFragment: {len(url) - len(OPENER) - 1} of 1900 characters.")
```
