---
name: tidigar
description: Make Tidigar roadmaps, Gantt charts and project timelines as share links that open as editable plans in Tidigar, and read or change a Tidigar link. Use when the user asks for a roadmap, timeline, Gantt chart or project plan in Tidigar, or gives a link to open.tidigar.com or app.tidigar.com.
---

# Tidigar

> Tidigar is a local-first roadmap and Gantt chart editor. An AI agent can turn a list of activities into a Tidigar share link: one clickable URL that carries the whole roadmap in its fragment and opens it as an editable timeline in the user's own Tidigar. No account, API key, backend or upload is involved, and nothing about the roadmap is stored on a server.

This skill includes the reference module as `scripts/tidigar-link.mjs`, the Python builder as `scripts/tidigar_link.py`, the examples as `examples.md` and the share link specification as `references/share-links.md`, beside this file. Run the module from there, such as `node scripts/tidigar-link.mjs plan.json`, or the builder with `python3 scripts/tidigar_link.py plan.json`, instead of downloading or copying them.

Use this when a user asks for a Gantt chart, timeline, project plan or roadmap made with Tidigar, or gives you a Tidigar link to change. This file is all you need to make and change links. Your answer is always a clickable link, and building one needs code execution, because the roadmap is compressed into the link.

## Rules

Follow this file exactly. A link that breaks one rule does not open, and Tidigar cannot repair it.

1. Choose how you build the link, in this order:
   - You can run Node.js, Deno or Bun and download a file, or you have the Tidigar skill: use [the reference module](#the-reference-module).
   - You can run Python, also without internet access, as in ChatGPT: use [the Python builder](#the-python-builder). Copy it into a file exactly as written, without shortening or rewriting it.
   - You cannot run code: say so and give the plan instead. Never invent a link.
2. Write a plan with only the fields this file describes. Do not guess a field, a value or a format; a field that is not listed does not exist.
3. Never write the link, its `s=1.…` text, the compact payload, day offsets or option numbers yourself. Only the module or the builder writes them.
4. Read the summary they print and compare it with the request before you answer.
5. When the user wants something a plan cannot express, read the [share link specification](https://tidigar.com/docs/share-links.md) first and follow every rule in it. Never fill a gap from memory.

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
3. Build the link from it: `node tidigar-link.mjs plan.json`, or `python3 tidigar_link.py plan.json` with the Python builder.
4. Compare the summary it prints against the request, and fix the plan if it differs. When it prints an error, fix the record it names and build again.
5. Answer with the link, `https://open.tidigar.com/s#s=1.…`, as a clickable link, exactly as printed.

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

- These are all the fields. Any other field is an error; owners, status and categories are dimensions, set through `values`.
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
python3 tidigar_link.py --read "https://open.tidigar.com/s#s=1.…" > plan.json
```

A plan leaves out a link's saved views and finer view settings, and the module says so when a link has them.

## The Python builder

When you can run Python but not the module, for example in a sandbox without internet access, save this code as `tidigar_link.py`, exactly as written, and run it on the plan. It checks the same rules as the module, builds the same link and prints the same summary, or an error that names the rule and the record. It needs only Python 3.8 or later. The same file is at `https://tidigar.com/agents/v1/tidigar_link.py`.

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
        "activity": ["title", "start", "end", "description", "progress", "values", "dependsOn"],
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
        dated += [start, end]
        rows.append([text(a.get("title", ""), f"{path}.title", 180), start, end - start,
                     text(a.get("description", ""), f"{path}.description", 10**6), progress,
                     values, depends(a.get("dependsOn"), f"{path}.dependsOn", True), path])
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

    # Dependencies: a day after each activity waited for, or on a fixed milestone's date.
    for row in rows:
        for index in row[6]:
            if index >= len(rows):
                mark = marks[index - len(rows)]
                if row[1] < mark[1]:
                    fail(f"{row[7]}.start", f"must not be before fixed milestone {mark[4]}")
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
        payload["i"] = [trim([t, s - base, n, d, pr, [v.get(k, 0) for k in range(max(v, default=-1) + 1)], dep],
                             [None, None, None, "", 0, [], []]) for t, s, n, d, pr, v, dep, _ in rows]
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
    after = lambda refs: " · after " + ", ".join(map(place, refs)) if refs else ""
    lines = [f"{payload['n']} ({payload['y']}{', work days' if payload.get('w') else ''})"]
    for i, row in enumerate(rows):
        row = row + ["", 0, 0, "", 0, [], []][len(row):]
        lines.append(f"activities[{i}] {row[0] or '(untitled)'}: {iso(base + row[1])} – {iso(base + row[1] + row[2])}"
                     + (f" · {row[4]}% done" if row[4] else "")
                     + "".join(f" · {dims[k][0]}: {dims[k][1][v - 1][0]}" for k, v in enumerate(row[5]) if v)
                     + after(row[6]))
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

## Show it in the chat

Always give the clickable link. Where you can render HTML, you may also show the roadmap; `node tidigar-link.mjs --embed plan.json` prints this frame:

```html
<iframe src="https://embed.tidigar.com/#s=1.…" title="Website launch" width="100%" height="480" style="border:0"></iframe>
```

## More, when you need it

- [Examples](https://tidigar.com/agents/examples.md): a full request, plan, output and answer, and a change to a link.
- [llms-full.txt](https://tidigar.com/llms-full.txt): this file, the examples and the share link specification in one file. Read it instead of this file, not as well: it starts with this file word for word.

## Reference

The module and the Python builder already follow these rules, so you do not need them to make or change a link. Read the share link specification in full before you write any payload yourself or use something a plan cannot express.

- [Share link specification](https://tidigar.com/docs/share-links.md): every field and limit of the payload, including saved views and filters a plan cannot express.
- [Embed stories](https://tidigar.com/docs/stories.md): timed changes with captions that play on an embedded roadmap. Only for an animated demo or tutorial.
- [Roadmaps in Markdown](https://tidigar.com/docs/markdown.md): a roadmap as text, for a repository or a document.
- [Roadmap file format](https://tidigar.com/docs/file-format.md): the full model with IDs, for Tidigar's JSON and `.tidigar` files.
- [Plan schema](https://tidigar.com/schema/plan-v1.json) and [payload schema](https://tidigar.com/schema/share-link-v1.json): JSON Schema 2020-12, for validation in your own code.
- [Example roadmaps](https://tidigar.com/examples/): ready-made plans to start from.
