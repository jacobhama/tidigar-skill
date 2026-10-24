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
    data = url.split("#", 1)[-1].split("&", 1)[0].split("s=1.", 1)[1]
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
