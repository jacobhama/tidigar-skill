# Tidigar share link specification

See [sharing a roadmap as a link](https://tidigar.com/guides/sharing) for the Share link dialog.

Public pre-release specification, versions 1 and 2. A readable link carries
an editable roadmap as plain text records and opens without an account.

Hamacher Software AB publishes this specification under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The keywords **MUST**, **MUST NOT**, **SHOULD** and **MAY** are normative.
The roadmap model, its field rules and limits are defined in the
[Tidigar Roadmap Interoperability Specification](https://tidigar.com/agents/docs/file-format.md).

## Link format

```text
https://open.tidigar.com/s#t=1~<record>~<record>~…~!
```

Links open in the web app or in an installed Tidigar app that claims the link.
Until the opener is deployed, use `https://app.tidigar.com/#t=1~…` for the web app.

- The fragment starts with `t=1` or `t=2`. Records follow, each after a `~`, as
  `key=value` or a one-letter flag, in any order. `!` ends the link.
- The whole link SHOULD stay within **2,000 characters**: the fragment within
  **1,900**. Share larger roadmaps as project files.
- Browsers keep the fragment on the device when requesting the page.

## Records

| Record                  | Holds                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `n=Name`                | the roadmap's name, required                                  |
| `d=Text`                | its description                                               |
| `y=2026`                | its year, required: the year of every `MM-DD` date            |
| `w`                     | plans in work days: Monday to Friday, without periods         |
| `u=thousands` | display costs in thousands |
| `k=SEK` | the plan currency for estimated costs, when present |
| `r=KEY`                 | the reference key prefix, up to 10 capital letters and digits |
| `m1=Team:Design,Build`  | a dimension and its options, in order                         |
| `a1=title/start/days/…` | an activity                                                   |
| `s1=title/date/…`       | a milestone                                                   |
| `p1=title/start/days`   | a period                                                      |
| `v=timeline/…`          | the view the roadmap opens in                                 |
| `c=3.1.1`               | the number of activities, milestones and periods              |

Numbered records count from 1: `a1`, `a2`, … A link MUST NOT skip a number,
and `c=` MUST give the counts, so a missing record or a cut link is noticed.

### Activities

```text
a3=Install_new_unit/11-02/5/Installer,Install/@a2,s2/50p/d=Ask_for_permits
```

- **Title**, then **start** (`MM-DD` always uses `y`; `YYYY-MM-DD` can use
  any year), then **days** (`1` for a single day). Work-day plans skip
  weekends and periods. For undated work use `-/-` for start and days,
  as in `a1=Request_quotes/-/-`.
- Then, in any order:
  - **Options** by name, comma-separated, one per dimension in `m1`, `m2`, …
    order. When a name belongs to several dimensions, its position selects
    the dimension: with `m1=Team:Network,Servers` and
    `m2=Phase:Inventory,Network`, `Network,Network` sets both Team and Phase
    to Network. Empty positions are allowed: `,Network` sets only Phase.
    Unique names also work in any order. To select a dimension explicitly,
    write `Team:Network` or `Phase:Network`; the prefix takes priority over
    position. If a shared name does not match its position, Tidigar reports
    the ambiguity and uses the first matching dimension.
  - **Dependencies** after `@`, comma-separated, by key, such as
    `@a1,s2,p1`. The activity starts after each ends, or on a milestone's date; `@a1:50` lets it start once 50% of `a1`'s planned days have
    passed (`0`, `25`, `50` or `75`). Links involving undated activities
    preserve dependency order without constraining dates or allowing overlap
    shares. Dependencies MUST NOT form a cycle.
  - **Estimated cost** as `cost=1250000` in the currency’s minor units. Set
    the plan currency with `k=SEK` (also supports EUR, USD, GBP, NOK and DKK).
    Omit the field for an unestimated activity.
  - **Progress** as `0p`, `25p`, `50p`, `75p` or `100p`. An option whose
    name looks like this is written with its dimension, such as `Size:50p`.
  - `d=` carries the activity's [Markdown source](https://tidigar.com/agents/docs/file-format.md#item-activity).
    Preserve whitespace and line breaks with the text escapes below. The
    fragment limit applies to the whole link.

### Milestones and periods

```text
s1=Heat_pump_in_operation/11-09/@a3
s2=Contract_signed/10-30/fixed
p1=Autumn_break/10-26/5
```

- A milestone has a title and a date, or `-`, then `@` and what it waits
  for; `fixed` marks an event on a set date, such as a decision.
- A period is a titled band across the timeline, such as a holiday: title,
  start and days. It is time off, without work days.

### Dimensions and the view

- `m1=Team:Household,Installer` defines ordered options with standard colors.
- `v=` selects `timeline`, `board`, `list` or `flow`. Use dimension names
  and dates as in `v=timeline/color:Team/group:Phase/start:10-01/end:12-31`.
  Board grouping uses `rows:` and `columns:`.
- Timeline layout is `classic` (one activity per row, fixed labels and reference
  keys) or `compact` (shared rows). Styles are `minimal`, `airy`, `contrast`
  and `terminal`. A layout or style alone selects the timeline, as in `v=classic`.

Use `progress` for rows or columns and `@progress` or `@follow-up-status`
for color. Links omit assignee settings.

### Text

- `_` is a space.
- In a title, a note or a name, write these characters escaped: `~` `%7E`,
  `/` `%2F`, `_` `%5F`, `%` `%25`, `&` `%26`, `#` `%23`, `(` `%28`, `)`
  `%29`, `"` `%22`, `<` `%3C`, `>` `%3E`, backtick `%60`, `{` `%7B`,
  `}` `%7D`, `[` `%5B`, `]` `%5D`, vertical bar `%7C`, backslash `%5C`
  and `^` `%5E`. Encode a line feed as `%0A`, a carriage return as `%0D`
  and a tab as `%09`. In a dimension or option name also escape `,` `%2C`,
  `:` `%3A`, `@` `%40` and `=` `%3D`.
- Other characters, such as å, ä, ö or `–`, are written as they are.
- Titles are up to 180 characters, names up to 100, the roadmap's description
  up to 500.

## Tracking records

Use `t=2` for a readable link with baseline or actuals. Its other
records follow the same grammar as version 1. Tracking fields are
separated with `/` and write missing values as `-`.

- `b=<UTC capture timestamp>/<currency or ->` starts a baseline. It may
  have no rows.
- `b1=<work key or historical UUID>/<activity or milestone>/<start>/<end>/<budget>`
  records one baseline row. Repeat as `b2`, `b3` and so on. The removed
  work's UUID stands in for a work key. Milestones put their planned
  moment in start and leave the end and budget absent.
- `x1=<work key>/<actual start>/<actual finish>/<actual cost>` records
  actuals for live work. A milestone has only actual finish. List each
  work key at most once.

Use full dates `YYYY-MM-DD` or local minutes `YYYY-MM-DDTHH:mm` for
tracking values, minor units for budgets and actual costs, and whole
seconds in the UTC timestamp. Zero survives a copy. Compact copy links
with tracking use `s=2`; other compact links use `s=1`. Full copies
include historical baseline rows and give live records new IDs. A copy
limited to visible activities keeps baseline rows only for the records
included in that copy. Published screen views omit baseline, actuals and tracking columns.

## Example

```text
https://open.tidigar.com/s#t=1~n=Heat_pump_replacement~y=2026~w~m1=Team:Household,Installer~m2=Phase:Plan,Install~a1=Review_current_system/10-12/3/Household,Plan~a2=Request_quotes/10-15/6/Household,Plan/@a1~a3=Install_new_unit/11-02/5/Installer,Install/@a2,s2~s1=Heat_pump_in_operation/11-09/@a3~s2=Contract_signed/10-30/fixed~p1=Autumn_break/10-26/5~v=timeline/color:Team/group:Phase~c=3.2.1~!
```

Installation waits for quotes and the signed contract. The work-day timeline
groups by Phase and colors by Team.

## Opening a link

Tidigar copies the roadmap into the recipient's library with new record IDs.
Reopening the same link on a device selects that copy.

Activities and milestones get reference keys in link order (`WL-1`, `WL-2`),
using `r=` or a prefix derived from the plan name. The first saved view is
Classic, framed by the earliest and latest activity or milestone dates with
three days of margin on each side. Later periods remain visible. The plan
opens in `v=` when present and Classic by default.

Tidigar reports repairs by record, such as clearing an unknown option or
moving an activity after its dependency. For irremediable input such as
`a1: start "02-30" is not a date`, Tidigar refuses the link and lists every
problem. Repairs preserve all activities, milestones and periods.

Open Tidigar's compressed links (`#s=1.…` or `#s=2.…`) in the app.

## Optional validation

To check a finished link locally:

```sh
node tidigar-link.mjs --validate "<finished URL>"
```

The module reports dates, dependencies, counts, fragment length and corrections.
It leaves the link unchanged. Exit 0 means it opens without corrections. Exit 1
means invalid input, corrections or a fragment over 1,900 characters.

## Building a link from JSON

The [agent guide](https://tidigar.com/agents) links to the Plan JSON v1
schema and local builders. The builders validate the plan and print the link,
dated summary and fragment length, or name the invalid rule and record.
`--read <link>` prints Plan JSON from a `t=1` link. The module exports
`createLink(plan)`, `readLink(link)` and `embedCode(link, title)`.

See [llms.txt](https://tidigar.com/llms.txt) for direct authoring and worked examples.
