# Tidigar share link specification

See [sharing a roadmap as a link](https://tidigar.com/guides/sharing),
with the Share link dialog and the steps to copy a link.

Status: public pre-release specification, version 1. It defines how any tool,
script or AI agent writes a link that opens a complete, editable Tidigar
roadmap. The link carries the whole roadmap itself, so nothing is uploaded,
nothing is stored on a server and no account is needed. A link is plain text,
written one record at a time; it needs no code, compression or encoding.

License: published by Hamacher Software AB under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Anyone may
implement the format it describes, in any software, without asking.

The keywords **MUST**, **MUST NOT**, **SHOULD** and **MAY** are normative.
The roadmap model, its field rules and limits are defined in the
[Tidigar Roadmap Interoperability Specification](https://tidigar.com/agents/docs/file-format.md).

## Link format

```text
https://open.tidigar.com/s#t=1~<record>~<record>~…~!
```

It opens the Tidigar web app with the roadmap, or the Tidigar app when it is
installed and claims the link. The opener is not deployed yet; until it is,
`https://app.tidigar.com/#t=1~…` opens the same roadmap in the web app.

- The fragment starts with `t=1`. Records follow, each after a `~`, as
  `key=value` or a one-letter flag, in any order. `!` ends the link.
- The whole link SHOULD stay within **2,000 characters**: the fragment within
  **1,900**. A larger roadmap is shared as a project file. Links are meant to
  be small, useful starting plans that fit in a chat message, an email or a QR
  code.
- The fragment is never sent to a server by browsers, so the roadmap stays
  between the sender and the recipient.

## Records

| Record                  | Holds                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `n=Name`                | the roadmap's name, required                                  |
| `d=Text`                | its description                                               |
| `y=2026`                | its year, required: the year of every `MM-DD` date            |
| `w`                     | plans in work days: Monday to Friday, without vacations       |
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

- **Title**, then **start**: `MM-DD` in year `y`, or `YYYY-MM-DD` for another
  year. Then **days**: how many days it lasts, `1` for a single day. In a
  roadmap planned in work days these are work days, skipping weekends and
  vacation periods.
- Then, in any order:
  - **Options** by name, comma-separated, one per dimension. Where two
    dimensions have an option of the same name, write `Team:Design`.
  - **Dependencies** after `@`, comma-separated: activities and fixed
    milestones by key, such as `@a1,s2`. The activity starts after each of
    them ends; `@a1:50` lets it start once 50% of `a1`'s planned days have
    passed (`0`, `25`, `50` or `75`). An activity MUST NOT start before what
    it depends on allows, and dependencies MUST NOT form a cycle.
  - **Progress** as `0p`, `25p`, `50p`, `75p` or `100p`. An option whose
    name looks like this is written with its dimension, such as `Size:50p`.
  - `d=` a description.

### Milestones and periods

```text
s1=Heat_pump_in_operation/11-09/@a3
s2=Contract_signed/10-30/fixed
p1=Autumn_break/10-26/5
```

- A milestone has a title and a date, then `@` and the activities it waits
  for, at least one day after each ends; or `fixed` for an event on a set
  date, such as a decision, that activities wait for.
- A period is a titled band across the timeline, such as a holiday: title,
  start and days. It is a vacation, without work days, unless `work` follows.

### Dimensions and the view

- `m1=Team:Household,Installer` names a dimension and its options in order.
  A link has no colors: options take Tidigar's standard colors in order.
- `v=` opens the roadmap in `timeline`, `board`, `list` or `flow`, followed
  by `rows:`, `columns:`, `color:` or `group:` and a dimension's name, and by
  `start:` and `end:` and a date for the timeline's span:
  `v=timeline/color:Team/group:Phase/start:10-01/end:12-31`.
- Words set how a timeline looks: `classic` shows one activity per row under
  a fixed label column with reference keys, as in MS Project, and opens the
  roadmap in its Classic view; `compact` lets activities share rows; `minimal`,
  `airy`, `contrast` and `terminal` choose a style. A word alone means a
  timeline: `v=classic`.

### Text

- `_` is a space.
- In a title, a note or a name, write these characters escaped: `~` `%7E`,
  `/` `%2F`, `_` `%5F`, `%` `%25`, `&` `%26`, `#` `%23`, `(` `%28`, `)`
  `%29`, `"` `%22`, `<` `%3C` and `>` `%3E`. In a dimension or option name
  also `,` `%2C`, `:` `%3A`, `@` `%40` and `=` `%3D`.
- Other characters, such as å, ä, ö or `–`, are written as they are.
- Titles are up to 180 characters, names up to 100, the roadmap's description
  up to 500.

## Example

```text
https://open.tidigar.com/s#t=1~n=Heat_pump_replacement~y=2026~w~m1=Team:Household,Installer~m2=Phase:Plan,Install~a1=Review_current_system/10-12/3/Household,Plan~a2=Request_quotes/10-15/6/Household,Plan/@a1~a3=Install_new_unit/11-02/5/Installer,Install/@a2,s2~s1=Heat_pump_in_operation/11-09/@a3~s2=Contract_signed/10-30/fixed~p1=Autumn_break/10-26/5~v=timeline/color:Team/group:Phase~c=3.2.1~!
```

A heat pump replacement planned in work days: three activities by Team and
Phase, the installation waiting both for the quotes and for the signed
contract, a completion milestone, and the autumn break as a vacation week. It
opens as a timeline grouped by Phase and colored by Team.

## Opening a link

Tidigar adds the opened roadmap to the recipient's own library and shows it
in the link's view. Every record gets a new identity, so each opening is an
independent copy: editing it never changes the link or anyone else's copy.
Opening the same link again on a device selects the copy it made.

The copy is made as a new roadmap is: its activities and milestones get
reference keys in the link's order, such as `WL-1`, `WL-2`, under the prefix
`r=` gives or one made from the roadmap's name, and it gets the Classic view
beside the view it opens in.

Tidigar reads a link leniently and says what it did. What has an obvious fix
is fixed and reported by record, for example `a3: no dimension has the
option "Done"; it was left empty`, or an activity that starts before what it
depends on is moved later. A link with a problem that has no fix, such as
`a1: start "02-30" is not a date`, is refused with every problem listed.
Tidigar shows the report so it can be passed back to whoever wrote the link.
Tidigar never drops an activity, a milestone or a period.

Tidigar shares links of its own in a compressed form, `#s=1.…`. They are not
meant to be read or written by hand; open them in Tidigar.

## Building a link

`https://tidigar.com/agents/v1/tidigar-link.mjs` (Node.js 20 or later, Deno or
Bun) and `https://tidigar.com/agents/v1/tidigar_link.py` (Python 3.8 or
later) build a link from a plan: the roadmap as JSON with real dates and
names, described by `https://tidigar.com/agents/schema/plan-v1.json`. They
validate it with Tidigar's own rules, print the link, a summary with real
dates and the fragment length, or an error that names the broken rule and
the record, such as `activities[2] "Build"`. `--read <link>` prints a link's
roadmap as a plan to change and build again. They run locally and send
nothing anywhere. As a module, `tidigar-link.mjs` exports `createLink(plan)`,
`readLink(link)` and `embedCode(link, title)`.

Instructions for AI agents, with these builders and a worked example, are at
[tidigar.com/llms.txt](https://tidigar.com/llms.txt).
