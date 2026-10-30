# Work on plans stored in Tidigar

## Plans stored in Tidigar

Tidigar Business and Tidigar Server keep plans for an organisation. Use this section when the user
asks to save, list, open or change a stored plan, or gives a `/p/<code>` link. A link to that plan
opens the shared plan; a share link opens a separate copy. The code is not the plan's id: list the
organisation's plans and use the one whose `url` matches the link, ignoring anything after `?` or
`#`.

**A stored plan is not a share link.** For a new plan, use the optional
[plan JSON format](https://tidigar.com/agents/plan-json.md):

- You use the `tidigar` command or the HTTP API, never the link builders.
- A stored plan is a full project with IDs, colors and saved views, as in the
  [roadmap file format](https://tidigar.com/agents/docs/file-format.md), not a `plan.json`. You
  change it by editing that project, never by rebuilding it from a plan, which would lose its IDs
  and views.
- It is saved on a server and every member of the organisation sees your changes, often while they
  edit; a share link is stored nowhere.
- Its `url` opens it only for signed-in members and holds no roadmap data. Never decode it or build
  a share link from it.

Use the first mode that works:

1. **MCP:** your tools include `tidigar_get_plan`. The steps below map to the tools
   `tidigar_list_plans`, `tidigar_get_plan`, `tidigar_validate_plan`, `tidigar_create_plan` (`plan`
   or `project`, `newId`) `tidigar_update_plan` (`id`, `revision`, `project`, `merge`),
   `tidigar_resolve_merge` (`id`, `choices`), `tidigar_delete_plan` (`id`, `revision`),
   `tidigar_list_trash` and `tidigar_restore_plan` (`id`); errors carry the same codes.
2. **CLI:** `tidigar status` exits 0. It keeps the token in the system's credential store.
3. **HTTP:** `TIDIGAR_TOKEN` is set and you can make HTTPS requests; see
   [over HTTP](#stored-plans-over-http).
4. **None:** explain that you are not connected and have not read, saved or changed the stored plan.
   Point the user to [Connect your AI assistant](https://tidigar.com/agents/cloud). For CLI access,
   they create a token under **Account → Agent access** and run `tidigar login` themselves or set
   `TIDIGAR_TOKEN`. Never ask for the token in the chat, print it or write it to a file. Offer a
   share-link copy as an alternative for a new plan, but do not substitute it for a requested save
   or update.

With the CLI signed in, the user can add the MCP tools, for example
`claude mcp add tidigar -- tidigar mcp` (`tidigar mcp --read-only` offers no writes).

All modes use the same JSON and errors as the [public API](https://tidigar.com/agents/docs/api.md).

- **New plan:** write `plan.json` as in
  [the plan JSON reference](https://tidigar.com/agents/plan-json.md), run
  `tidigar plans validate plan.json`, check its summary, then `tidigar plans create plan.json`.
  Answer with the plan's `url`, which opens it for signed-in members.
- **Change a plan:** `tidigar plans list` shows each `id`, also the end of its `url`.
  `tidigar plans get <plan-id> --out plan.json` saves its `revision` and `project`. Edit `project`
  per the roadmap file format, keeping IDs and giving new records new UUIDs, then
  `tidigar plans update plan.json --merge`.
- Someone may save the plan while you work. `--merge` then combines both changes and saves. Exit 5
  with `merge_conflicts` means both changed the same things and nothing was saved: stdout lists each
  conflict with an `id`, what it is `about`, the `change`, and the `base`, `mine` and `latest`
  values. Tell the user each conflict in plain words, ask which to keep, and never choose for them.
  Then run `tidigar plans resolve <mergeFile> --choices '{"c1":"mine","c2":"latest"}'` with an
  answer for every conflict. If it lists new conflicts, ask about those the same way.
- Exit 5 with `stale_revision`: the plan changed and could not be merged. Get it again, show the
  user what changed, redo your edit and update again; never overwrite the other change.
- **Delete a plan** only when the user asks, and confirm first by its name.
  `tidigar plans get <plan-id>` gives its `revision`;
  `tidigar plans delete <plan-id> --revision <n>` moves it to the trash, where it stays 30 days.
  Exit 5 with `stale_revision`: someone changed it since; get it again and ask again.
  `tidigar plans trash` lists deleted plans and `tidigar plans restore <plan-id>` brings one back.
- **Screens:** a screen shows one saved view of a stored plan to anyone with its link, on a wall
  screen or a web page, and may play a story written in the
  [story language](https://tidigar.com/agents/docs/stories.md) with the plan's own titles and dates.
  `tidigar screens list <plan-id>` lists them.
  `tidigar screens create <plan-id> --view <view-id> --name <name> --story story.txt` makes one,
  `--name` and `--story` optional; ask the user first, since anyone with its link sees that view.
  `tidigar screens update <plan-id> <screen-id>` changes its `--story` file, `--name` or
  `--join-code on|off`. To change what a screen shows, update its saved view in the project and keep
  the view's `id`: deleting the view ends the screen. `tidigar screens link <plan-id> <screen-id>`
  prints its `url`; give it only to the user, never write it into a plan, a file or a public place.
  `tidigar screens delete <plan-id> <screen-id>` ends the link for good; confirm first. Exit 3 with
  `agent_screens_off`: the owners keep making screens and reading links to people.
- **A plan's history as a story:** when the user gives you the versions of a schedule, such as
  screenshots of the Gantt chart shown at each status meeting, store the latest version as the plan
  and write a story that replays the versions on a screen. Read every version first and match
  activities across them by meaning, not only by title. At `0:00`, set the plan to the first version
  without animation: `hide` what came later, `update` dates, progress and earlier titles, `add` what
  was dropped later, and `today("YYYY-MM-DD")` for the first meeting. Then give each later meeting
  one moment four to six seconds apart: its `today`, its changes (`changeDates`, `update`, `show`,
  `remove`) and a `caption` saying what changed and why if the slides say. End on the stored plan
  and `loop()`. The pattern is under "A plan's history" in the story language. Creating or updating
  the screen answers `storyWarnings`: each call a reader's screen would skip, by line. Fix them and
  update the story until the list is empty, then give the user the screen's link.
- Exit 7 (`write_unknown`): the write may or may not be saved. Get the plan and report what it
  holds; never repeat a write blindly.
- Exit 2: ask the user to run `tidigar login`. Exit 3: read-only token, viewer or no subscription.
  Exit 4: no such plan. Exit 5 with `plan_exists`: it already exists; `--new-id` saves a copy if the
  user wants one. Exit 6: too large.

### Stored plans over HTTP

The token stays in the environment, never in a command, output or the chat. `TIDIGAR_SERVER` names a
Tidigar Server.

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

- `GET /token`: `organization.id` is `ORG`; `writable` says whether you may save.
  `GET /organizations/:org/plans` lists plans.
- New plan: send `{ "plan": … }` to `POST /organizations/:org/plans/validate`, which answers
  `{ project, summary }`, then create with `{ "project": … }` to keep its ID.
- Change: `GET /organizations/:org/plans/:id`, edit `project`, and send `{ "project": … }` to
  `PUT /organizations/:org/plans/:id` with the read `revision` as `REVISION`.
- Someone saved first (`stale_revision`): send `{ "base": REVISION, "project": … }` to
  `POST /organizations/:org/plans/:id/merge`, which combines both changes and saves.
  `merge_conflicts` lists `conflicts` as for the CLI, each with its own `id`: ask the user about
  each, then send the same body with `"choices": { "<id>": "mine" | "latest" }` for every conflict
  so far, until it saves.
- Delete, after the user confirms: `DELETE /organizations/:org/plans/:id` with the read `revision`
  as `REVISION` moves it to the trash for 30 days. `GET /organizations/:org/trash` lists deleted
  plans; `POST /organizations/:org/trash/:id/restore` brings one back.
- Errors are `{ "error": { "code", "message" } }`. `stale_revision` also carries the latest `plan`;
  if `merge` answers `no_such_revision`, redo your edit on it. After a lost answer, or `plan_exists`
  on a retried create, get the plan and compare before writing.
