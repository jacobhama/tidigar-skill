"""Readable Tidigar links (#t=1~...) from plans: https://tidigar.com/llms.txt
python3 tidigar_link.py plan.json      build a link; - reads standard input
python3 tidigar_link.py --read LINK    print a link's roadmap as a plan"""
import datetime, json, re, sys, urllib.parse

OPENER = "https://open.tidigar.com/s"
COLORS = ["4f7cff", "16a34a", "f59e0b", "8a52c1", "0891b2", "dc5f5f", "64748b", "db2777"]
PERIOD_COLOR = "9aa7b5"
VIEW = {"type": "view", "groupBy": "group", "colorBy": "color", "rows": "row",
        "columns": "col", "start": "timelineStart", "end": "timelineEnd",
        "layout": "timelineActivityRows", "style": "presentationStyle"}
# classic: one activity per row under a fixed label, as in MS Project; compact: shared rows.
LAYOUTS = {"classic": "single-label", "compact": "compact"}
STYLES = ["standard", "minimal", "airy", "contrast", "terminal"]
KEYS = {"plan": ["$schema", "version", "name", "description", "workDays", "dimensions",
                 "activities", "milestones", "periods", "view"],
        "activity": ["title", "start", "end", "description", "progress", "values", "dependsOn", "startAfter"],
        "milestone": ["title", "date", "dependsOn", "fixed"],
        "period": ["title", "start", "end", "color", "vacation"],
        "option": ["name", "color"], "view": list(VIEW)}
AXES = {"rows": "row", "columns": "col", "color": "color", "group": "group"}
MODES = {"grid": "board", "timeline": "timeline", "list": "list", "flow": "flow"}


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

    # Colors matter in a stored plan; a link carries none.
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
        elif key == "layout":
            if value not in LAYOUTS:
                fail("view.layout", "must be classic or compact")
            o[field] = LAYOUTS[value]
        elif key == "style":
            if value not in STYLES:
                fail("view.style", "must be " + ", ".join(STYLES))
            o[field] = value
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


ESCAPED = set('%~/_&#"<>`(){}[]|\\^')


def field(value, also=""):
    """Text in a field: a space is _, and what would split a field is escaped."""
    return "".join("_" if c == " " else urllib.parse.quote(c, safe="") if c in ESCAPED or c in also or c.isspace()
                   else c for c in str(value)).replace("~", "%7E")


def name(value):
    return field(value, ",:@=")


def size(text):
    """Characters as JavaScript and browsers count them: UTF-16 code units."""
    return len(text.encode("utf-16-le")) // 2


def link(payload):
    """The readable link of a checked payload: t=1~...~!"""
    year = payload["y"]
    base = datetime.date(year, 1, 1).toordinal()
    dims, rows, marks, bands = payload.get("m", []), payload.get("i", []), payload.get("s", []), payload.get("p", [])

    def date(offset):
        value = iso(base + offset)
        return value[5:] if value.startswith(f"{year}-") else value

    vacations = [(p[1], p[1] + p[2]) for p in bands if (p[4] if len(p) > 4 else 1) == 1]

    def working(offset):
        return datetime.date.fromordinal(base + offset).weekday() < 5 and not any(a <= offset <= b for a, b in vacations)

    def days(start, length):
        if payload.get("w") != 1:
            return length + 1
        return max(1, sum(1 for d in range(start, start + length + 1) if working(d)))

    def key(index):
        return f"a{index + 1}" if index < len(rows) else f"s{index - len(rows) + 1}"

    out = ["t=1", f"n={field(payload['n'])}"]
    if payload.get("d"):
        out.append(f"d={field(payload['d'])}")
    out.append(f"y={year}")
    if payload.get("w") == 1:
        out.append("w")
    for k, (dim, options) in enumerate(dims):
        out.append(f"m{k + 1}={name(dim)}:" + ",".join(name(o) for o, _ in options))
    for k, row in enumerate(rows):
        title, start, length, description, progress, values, after, shares = (row + ["", 0, 0, "", 0, [], [], []][len(row):])[:8]
        parts = [field(title), date(start), str(days(start, length))]
        chosen = []
        for d, v in enumerate(values):
            if v:
                option = dims[d][1][v - 1][0]
                shared = any(option == o for e, (_, opts) in enumerate(dims) if e != d for o, _ in opts)
                chosen.append(f"{name(dims[d][0])}:{name(option)}" if shared or re.fullmatch(r"\d+p", option)
                              else name(option))
        if chosen:
            parts.append(",".join(chosen))
        if after:
            parts.append("@" + ",".join(key(x) + (f":{shares[i]}" if i < len(shares) and shares[i] != 100 else "")
                                        for i, x in enumerate(after)))
        if progress:
            parts.append(f"{progress}p")
        if description:
            parts.append(f"d={field(description)}")
        out.append(f"a{k + 1}=" + "/".join(parts))
    for k, m in enumerate(marks):
        parts = [field(m[0]), date(m[1])]
        if m[3:4] == [1]:
            parts.append("fixed")
        elif len(m) > 2 and m[2]:
            parts.append("@" + ",".join(key(x) for x in m[2]))
        out.append(f"s{k + 1}=" + "/".join(parts))
    for k, p in enumerate(bands):
        out.append(f"p{k + 1}={field(p[0])}/{date(p[1])}/{p[2] + 1}" + ("/work" if p[4:5] == [0] else ""))
    o = payload.get("o")
    if o:
        parts = [MODES[o.get("view", "grid")]]
        parts += [word for word, rows in LAYOUTS.items() if o.get("timelineActivityRows") == rows]
        parts += [o["presentationStyle"]] if o.get("presentationStyle", "standard") != "standard" else []
        parts += [f"{axis}:{name(dims[o[f]][0])}" for axis, f in AXES.items() if isinstance(o.get(f), int)]
        for edge, f in (("start", "timelineStart"), ("end", "timelineEnd")):
            if o.get(f):
                parts.append(f"{edge}:{date(datetime.date.fromisoformat(o[f]).toordinal() - base)}")
        out.append("v=" + "/".join(parts))
    out += [f"c={len(rows)}.{len(marks)}.{len(bands)}", "!"]
    fragment = "~".join(out)
    if size(fragment) > 1900:
        raise ValueError(f"The roadmap is too large for a link. It needs {size(fragment)} of 1900 characters; "
                         "shorten titles, drop descriptions and merge small activities.")
    return f"{OPENER}#{fragment}"


def payload_of(url):
    """A readable link's payload. Raises an error naming every record that cannot be read."""
    fragment = url.split("#", 1)[-1].split("&", 1)[0]
    records = fragment.split("~")
    if records[0] != "t=1":
        raise ValueError("Give a readable Tidigar link, #t=1~...")
    problems = []
    fields, lists = {}, {"a": {}, "s": {}, "p": {}, "m": {}}
    for record in records[1:]:
        if record in ("", "!"):
            continue
        match = re.fullmatch(r"([a-z])(\d*)(?:=(.*))?", record, re.S)
        if not match:
            problems.append(f"{q(record[:30])}: not a record")
        elif match[1] in lists and match[2]:
            lists[match[1]][int(match[2])] = match[3] or ""
        else:
            fields[match[1] + match[2]] = match[3] or ""

    def text(value):
        return urllib.parse.unquote(value.replace("_", " "))

    year = int(fields.get("y", "0") or 0)
    if not 1900 <= year <= 2200:
        raise ValueError("y: the link needs a year from 1900 to 2200")
    base = datetime.date(year, 1, 1).toordinal()

    def day(value, where):
        try:
            whole = value if re.fullmatch(r"\d{4}-\d\d-\d\d", value) else f"{year}-{value}"
            return datetime.date.fromisoformat(whole).toordinal() - base
        except ValueError:
            problems.append(f"{where}: {q(value)} is not a date as MM-DD or YYYY-MM-DD")
            return 0

    def count(value, where):
        if not re.fullmatch(r"\d+d?", value) or int(value.rstrip("d")) < 1:
            problems.append(f"{where}: days {q(value)} is not a whole number of days, 1 or more")
            return 1
        return int(value.rstrip("d"))

    ordered = {letter: sorted(entries.items()) for letter, entries in lists.items()}
    dims = []
    for number, value in ordered["m"]:
        dim, _, options = value.partition(":")
        dims.append([text(dim), [[text(o), COLORS[i % len(COLORS)]] for i, o in enumerate(options.split(",")) if o]])
    keys = {f"a{n}": i for i, (n, _) in enumerate(ordered["a"])}
    keys.update({f"s{n}": len(ordered["a"]) + i for i, (n, _) in enumerate(ordered["s"])})
    bands = []
    for number, value in ordered["p"]:
        title, start, length, *rest = value.split("/") + ["", ""]
        first = day(start, f"p{number}")
        bands.append([text(title), first, count(length, f"p{number}") - 1, PERIOD_COLOR, 0 if "work" in rest else 1])
    vacations = [(p[1], p[1] + p[2]) for p in bands if p[4] == 1]

    def end(first, n):
        if fields.get("w") is None:
            return n - 1
        d, seen = first - 1, 0
        while seen < n:
            d += 1
            if datetime.date.fromordinal(base + d).weekday() < 5 and not any(a <= d <= b for a, b in vacations):
                seen += 1
        return d - first

    def option_numbers(value, where):
        numbers = [0] * len(dims)
        for raw in filter(None, value.split(",")):
            dim, _, option = raw.rpartition(":")
            hits = [(k, [o for o, _ in opts].index(text(option)) + 1) for k, (d, opts) in enumerate(dims)
                    if (not dim or d == text(dim)) and text(option) in [o for o, _ in opts]]
            if hits:
                numbers[hits[0][0]] = hits[0][1]
            else:
                problems.append(f"{where}: no dimension has the option {q(text(raw))}")
        while numbers and not numbers[-1]:
            numbers.pop()
        return numbers

    def after(value, where):
        refs, shares = [], []
        for part in filter(None, value.split(",")):
            ref, _, share = part.partition(":")
            if ref not in keys:
                problems.append(f"{where}: the dependency {ref} names no record")
                continue
            refs.append(keys[ref])
            shares.append(int(share) if share else 100)
        while shares and shares[-1] == 100:
            shares.pop()
        return refs, shares

    rows = []
    for number, value in ordered["a"]:
        where = f"a{number}"
        title, start, length, *rest = value.split("/") + ["", ""]
        first = day(start, where)
        row = [text(title), first, end(first, count(length, where)), "", 0, [], [], []]
        for part in rest:
            if part.startswith("d="):
                row[3] = text(part[2:])
            elif part.startswith("@"):
                row[6], row[7] = after(part[1:], where)
            elif re.fullmatch(r"\d+p", part):
                row[4] = int(part[:-1])
            elif part:
                row[5] = option_numbers(part, where)
        rows.append(row)
    marks = []
    for number, value in ordered["s"]:
        title, date, *rest = value.split("/") + [""]
        refs = next((after(x[1:], f"s{number}")[0] for x in rest if x.startswith("@")), [])
        marks.append([text(title), day(date, f"s{number}"), refs, 1 if "fixed" in rest else 0])
    if problems:
        raise ValueError("; ".join(problems))
    payload = {"n": text(fields.get("n", "Roadmap")), "y": year}
    if fields.get("d"):
        payload["d"] = text(fields["d"])
    if "w" in fields:
        payload["w"] = 1
    for key, value in (("m", dims), ("i", rows), ("s", marks), ("p", bands)):
        if value:
            payload[key] = value
    if "v" in fields:
        mode, *settings = fields["v"].split("/")
        if mode in LAYOUTS or mode in STYLES:
            mode, settings = "timeline", [mode] + settings
        o = {"view": {v: k for k, v in MODES.items()}.get(mode, "timeline")}
        names = [d for d, _ in dims]
        for setting in settings:
            axis, _, value = setting.partition(":")
            if setting in LAYOUTS:
                o["timelineActivityRows"] = LAYOUTS[setting]
            elif setting in STYLES:
                o["presentationStyle"] = setting
            elif axis in AXES and text(value) in names:
                o[AXES[axis]] = names.index(text(value))
            elif axis in ("start", "end"):
                o["timeline" + axis.title()] = iso(base + day(value, "v"))
        payload["o"] = o
    return payload


def read(url):
    """A readable link's roadmap as a plan, to change and build again."""
    payload = payload_of(url)
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
            if key == "layout":
                view.update({"layout": w for w, rows in LAYOUTS.items() if rows == value})
            elif key == "style":
                if value != "standard":
                    view["style"] = value
            else:
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
        print(url + "\n\n" + summary(payload) + f"\n\nFragment: {size(url) - len(OPENER) - 1} of 1900 characters.")
