# Tidigar share link specification

Status: public pre-release specification, version 1. It defines how any tool,
script or AI agent can build a link that opens a complete, editable Tidigar
roadmap. The link carries the whole roadmap itself, so nothing is uploaded,
nothing is stored on a server and no account is needed.

License: published by Hamacher Software AB under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Anyone may
implement the formats it describes, in any software, without asking.

The keywords **MUST**, **MUST NOT**, **SHOULD** and **MAY** are normative.
The roadmap model, its field rules and limits are defined in the
[Tidigar Roadmap Interoperability Specification](https://tidigar.com/docs/file-format.md); this document
only defines the compact link encoding.

Links are shared through the public opener:

```text
https://open.tidigar.com/s#s=1.<data>
```

It opens the Tidigar web app with the roadmap, or the Tidigar app when it is
installed and claims the link. The opener is not deployed yet; until it is,
`https://app.tidigar.com/#s=1.<data>` opens the same roadmap in the web app.

## Why links are small

A whole share link is at most **2,000 characters**. That is a deliberate
limit, not a technical accident: a shared roadmap is a small, useful starting
plan that fits in a chat message, an email, a blog post or a QR code, and it
opens anywhere Tidigar runs. Larger roadmaps are shared as project files.

## Link format

```text
https://open.tidigar.com/s#s=1.<data>
```

- The fragment starts with `s=`, the format version `1` and a dot.
- `<data>` is the payload JSON, UTF-8 encoded, compressed with raw DEFLATE
  ([RFC 1951](https://www.rfc-editor.org/rfc/rfc1951), no zlib or gzip header)
  and encoded as base64url without padding
  ([RFC 4648 §5](https://www.rfc-editor.org/rfc/rfc4648#section-5)).
- The fragment including `s=1.` MUST be at most **1,900 characters**. An
  encoder MUST refuse a larger roadmap rather than drop content.
- The fragment is never sent to a server by browsers, so the roadmap stays
  between the sender and the recipient.

Tidigar keeps opening version 1 links. A change that a version 1 decoder
cannot read gets a new version number, and version 1 stays readable.

A decoder MUST reject another version, a longer fragment, characters outside
`A–Z a–z 0–9 - _`, data that does not inflate, more than **262,144** inflated
bytes, invalid JSON or a payload that does not describe a valid roadmap. It
MUST NOT open a partial roadmap.

## Payload

The payload is one JSON object. Records have no IDs: they refer to each other
by position. Two kinds of numbers appear:

- An **index** is a 0-based position in a list.
- An **option number** picks an option of a dimension: `0` means no option,
  `1` the first option, `2` the second, and so on.

Dates are whole **days from January 1 of `y`**; negative values are earlier.
A length is the number of days from start to the inclusive end, so `0` is a
single day. Colors are six hexadecimal digits without `#`.

| Key | Holds        | Required | Value                                                  |
| --- | ------------ | -------- | ------------------------------------------------------ |
| `c` | Link created | no | UTC ISO 8601 `YYYY-MM-DDTHH:mm:ssZ`, valid date and time |
| `n` | Roadmap name | yes      | text, 1–100 characters, not blank                      |
| `y` | Year         | yes      | integer 1900–2200; the base of every date              |
| `d` | Description  | no       | text, max 500 characters; default `""`                 |
| `w` | Work days    | no       | `1` plans in work days; absent plans in calendar days  |
| `m` | Dimensions   | no       | array of `[name, options]`, options `[name, color]`    |
| `i` | Activities   | no       | array of activity tuples                               |
| `s` | Milestones   | no       | array of milestone tuples                              |
| `p` | Period bands | no       | array of period tuples                                 |
| `v` | Saved views  | no       | array of view objects with a `name`                    |
| `o` | Initial view | no       | one view object without `name`; default view if absent |

New sharing links carry `c`, the instant the link was created, for example
`2026-10-05T12:30:00Z`. Readers preserve it as `manifest.shareLinkCreatedAt`
in the independent local copy and display it in the user's local time zone.
Editing the copy does not change this value or connect it to the author's plan.
It is separate from storage modification times. Older links without `c` remain
valid and do not acquire a timestamp. A new link from a copy gets a new `c`.
There is no persistent publication identity, replacement or synchronization.
Static templates may omit `c` when no sharing instant is known.

Missing lists are empty. At most 20 dimensions with 100 options each.

### Activity tuple

```text
[title, start, length, description, progress, values, dependsOn]
```

| Position | Field         | Value                                            |
| -------- | ------------- | ------------------------------------------------ |
| 0        | `title`       | text, max 180 characters; may be empty           |
| 1        | `start`       | day offset                                       |
| 2        | `length`      | days to the inclusive end, 0 or more             |
| 3        | `description` | text; default `""`                               |
| 4        | `progress`    | one of `0`, `25`, `50`, `75`, `100`; default `0` |
| 5        | `values`      | option numbers in dimension order; default `[]`  |
| 6        | `dependsOn`   | predecessor indices; see below                   |

Trailing default positions MAY be left out, and trailing `0` entries in
`values` MAY be left out. A missing value and `0` mean the same: no option.

A predecessor index below the number of activities refers to an activity,
which MUST end before this activity starts. An index from the number of
activities upward refers to the milestone at that index minus the number of
activities; it MUST be a fixed milestone, and this activity MUST NOT start
before its date.

### Milestone and period tuples

```text
[title, date, dependsOn, fixed]  milestone: dependsOn holds activity indices,
                                    fixed is 1 or 0, default 0
[title, start, length, color, vacation]
                                    period band: vacation is 1 or 0, default 1
```

A milestone's date MUST be at least one day after the end of each activity it
depends on. A fixed milestone, an event on a set date that activities
wait for, has `fixed` 1 and an empty `dependsOn`; a trailing 0 MAY be left
out. Titles are 1–180 characters. In a roadmap planned in work days,
a period with `vacation` 1 has no work days; a trailing 1 MAY be left out.

### View object

A view uses the saved-view fields of the [model specification](https://tidigar.com/docs/file-format.md#saved-view)
except `id`, `projectId` and `hideTimelineLabels`, with these changes:

| Field                            | Value in a link                                      |
| -------------------------------- | ---------------------------------------------------- |
| `row`, `col`, `color`, `group`   | dimension index, or `""` for none                    |
| `filters`                        | object: dimension index as key → option number       |
| `colorOverrides`                 | object: `"<dimension index>.<option index>"` → color |
| `listColumns`, `listColumnOrder` | `"title"`, `"start"`, `"end"` or a dimension index   |

Every other field keeps its model value, for example `"view": "timeline"`,
`"timelineScaleRows": 2` or `"timelineStart": "2026-01-01"`. A field left out
takes its model default, and encoders SHOULD leave defaults out.
`presentationStyle` selects `standard` (the default), `minimal`, `airy`, or `contrast`, in both light and dark mode.
`flowArrows` is `curved` (default) or `right-angle`; `flowShapes` is `capsules`
(default) or `flowchart`. They preserve the Flow arrow and node appearance.

`hideUnconnectedActivities` is a boolean with default `false`; `true` hides
activities without incoming or outgoing dependencies in Flow.

## Opening a link

Tidigar adds the opened roadmap to the recipient's own library at once and
shows it in the initial view. A decoder builds a canonical project from the payload, gives the project and
every record a new random UUID, and validates the result with every rule of
the model specification. The copy is independent: editing it never changes
the link or anyone else's copy. Tidigar remembers on each device which
roadmap a link made, so opening the same link there again selects that copy
instead of adding another. The initial view opens the roadmap but is not
saved as a view of it.

## Example

```json
{
  "n": "Website relaunch",
  "y": 2026,
  "d": "A small example template.",
  "m": [
    [
      "Team",
      [
        ["Design", "4f7cff"],
        ["Development", "16a34a"]
      ]
    ]
  ],
  "i": [
    ["Content audit", 5, 11, "", 100, [1]],
    ["New design", 19, 27, "", 50, [1], [0]],
    ["Build and test", 49, 41, "", 0, [2], [1]]
  ],
  "s": [["Launch", 93, [2]]],
  "p": [["Summer break", 180, 34, "f59e0b"]],
  "o": {
    "view": "timeline",
    "color": 0,
    "group": 0,
    "resolution": "week",
    "timelineEnd": "2026-04-30"
  }
}
```

The roadmap has one dimension, Team. Content audit runs 2026-01-06 to
2026-01-17 for Design and is done; New design runs 2026-01-20 to 2026-02-16
after it; Build and test runs 2026-02-19 to 2026-04-01 for Development; the
Launch milestone is on 2026-04-04; a Summer break band covers 2026-06-30 to
2026-08-03. It opens as a weekly timeline grouped and colored by Team through
April.

One valid encoding of that payload is this fragment of 364 characters.
Compressors differ, so another encoder MAY produce different data for the same
payload.

```text
s=1.PVC7bsMwDPwVgTNTyK-k9tbXVnRpgQ6GBzmmU6F6GLYctwjy76WEoFpE3B2P5F3AQQOf1C86kJjJqNUdvwDhF5pc5nuEgfkHsVhljKAfZSdDIhB_KtAdCy00bQsfpCwgF8-06JNjvBwPx3GEDiN2JuMnSy4wke1VUSro-CHo1P3kXWBSqHXQLKkwyxAAMymxzbpo8UabGG7WWY35IfJVorGVSfK4ajMI5QZeb2GXssYy2bAq75IRD1zSwNfbmXURuYhPCX9fraVZ9DOpbx50L7EoEcaqJtlDlHloLnDWtHEqQVsy2hHfdPTGz9BIhNPs1ylVMy3erEH7mPBGxIb_LS8uxhoD3slyV0i4Xv8A
```

## Building a link

Python:

```python
import base64, json, zlib

def share_fragment(payload):
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = deflate.compress(data) + deflate.flush()
    fragment = "s=1." + base64.urlsafe_b64encode(packed).decode("ascii").rstrip("=")
    if len(fragment) > 1900:
        raise ValueError("The roadmap is too large for a share link.")
    return fragment
```

JavaScript (browsers and Node.js 18 or later):

```js
async function shareFragment(payload) {
  const stream = new Blob([JSON.stringify(payload)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const base64 = btoa(String.fromCharCode(...bytes));
  const fragment = `s=1.${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  if (fragment.length > 1900) throw new Error('The roadmap is too large for a share link.');
  return fragment;
}
```

Before sharing, check the dates and dependencies against the rules above: a
link whose roadmap is invalid does not open.

## Reference encoder

`https://tidigar.com/agents/v1/tidigar-link.mjs` is Tidigar's own validation
and encoding as one ES module for Node.js 20 or later, Deno and Bun. It runs
locally and sends nothing anywhere. `node tidigar-link.mjs plan.json` takes a
payload or a plan: the same roadmap with real dates, dimension and option
names and activity titles instead of offsets and positions, which it turns
into a payload, filling in the year, option colors and an initial view over
the plan's dates. It prints the link, a summary with real dates and the
fragment length, or an error that names the broken rule and the record, such
as `activity i[2] "Build"` for a payload or `activities[2] "Build"` for a
plan. `--read <link>` prints a link's roadmap as a plan, without saved views
and view settings a plan has no field for; `--read --payload <link>` prints
the payload, and `--embed` also prints embed code. As a module it exports
`createLink(input)`, `readLink(link)` and `embedCode(link, title)`. The `v1`
in its address follows the link format version.

JSON Schemas (2020-12) describe both inputs:
`https://tidigar.com/schema/share-link-v1.json` the payload and
`https://tidigar.com/schema/plan-v1.json` the plan. Rules across records,
such as dependency dates and the fragment length, are checked by the encoder
and by Tidigar when a link opens, not by the schemas.

Instructions for AI agents, with this encoder and a worked example, are at
`https://tidigar.com/llms.txt`.

Saved views may include `timelineShowWeeks` and `timelineShowQuarters`,
boolean values defaulting to `true`. A `false` value excludes that level from
the adaptive timeline header without fixing the remaining scale levels.
