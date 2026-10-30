# Work on plans stored in Tidigar

Use this guide when a user asks to save, find, open or change a plan stored in
Tidigar Business or Tidigar Server, or gives a `/p/<code>` link. A public chat
assistant uses remote MCP with delegated OAuth authorization. The user's
consent grants access; reading this guide or installing the skill does not.

A stored plan is the original shared project. A `#t=1~…~!` link is an
independent copy. Do not replace a requested save or update with a share link.
If the destination is unclear, ask whether the user means the stored original
or a separate copy before writing.

## Connect through remote MCP

1. Discover the Tidigar tools available in the assistant's host, including tools
   that the host loads on demand. If `tidigar_status` is available, call it with
   no arguments. Check its `server`, `organization`, `scope`, `role` and
   `writable` against the request. Proceed with a write only when `writable`
   is true; otherwise follow the access-failure guidance below. Do not infer
   authorization from a plan URL.
2. If no Tidigar connection exists, use the host's connector setup flow when it
   supports connecting during the conversation. Otherwise guide the user to add
   an MCP connection in the assistant's app or connector settings. The address
   is `https://app.tidigar.com/mcp`; for Tidigar Server it is the user's server
   origin followed by `/mcp`. See
   [connection setup](https://tidigar.com/agents/cloud#a-chat-assistant).
3. Let the host's MCP client handle OAuth discovery and authorization. It opens
   Tidigar for the user to sign in, check the assistant's name and return
   address, choose the organisation, and approve **Read only** or **Read and
   write**. Request writing only when the task changes stored data. Consent must come
   from the user, never from the agent acting on their behalf.
4. After authorization completes, discover the tools again and call
   `tidigar_status`. Resume the original task after checking the organisation
   and effective access. Each connection reaches one organisation. If it is the
   wrong one, have the user select or authorize the correct connection.

The host keeps access and refresh tokens outside the conversation. Never ask
for personal tokens, passwords or OAuth codes in chat, and never put them in
prompts, files or shell commands. Do not replace this flow with the CLI,
`TIDIGAR_TOKEN` or direct API calls. Coding agents with separately configured
credentials use the [CLI and HTTP reference](https://tidigar.com/agents/stored-plans-cli.md).

Instructions cannot install MCP tools in a host that has no connector support.
If connection is unavailable, declined or fails, explain the connection step
that remains and that no stored change was made. Continue after the host makes
the authorized tools available; do not claim access or simulate a successful
save. Offer a separate copy only if the user wants one.

## Find and read the original

1. Call `tidigar_list_plans` with no arguments. For a `/p/<code>` link, match
   its URL to a returned plan's `url`, ignoring query and fragment. The code is
   not the plan ID. For a title, select the matching plan; ask if several match.
   If nothing matches, report it and check the intended organisation with the
   user. Do not guess an ID or search another organisation without access.
2. Call `tidigar_get_plan` with that `id`. Keep the returned `id`, `revision`
   and complete `project` for the update. Check its identity against the request.
3. Edit only the requested part of `project`. Preserve its project ID, record
   IDs, dimensions, saved views and unrelated content; new records need new
   UUIDs. Use the [roadmap file format](https://tidigar.com/agents/docs/file-format.md)
   for the fields you edit. Never rebuild an existing project from simplified
   plan JSON or a share link: that would lose its identities and views.

## Validate and save the change

1. Call `tidigar_validate_plan` with the edited `project`. It stores nothing.
   Compare its normalized `project` and `summary` to the user's request and fix
   validation errors before saving. Keep the original read revision.
2. Call `tidigar_update_plan` with the original `id`, original `revision`,
   validated `project` and `merge: true`. A successful result is the evidence
   that the change was saved; validation alone is not a save.
3. Return the stored plan's `url` and a short description of what was saved.
   The URL opens the original for signed-in members. Do not build a copy unless
   the user requested one. Changes are visible to other plan members.

### Concurrent edits and uncertain outcomes

- `merge_conflicts`: nothing was saved. Explain each conflict (`id`, `about`,
  `change`, `base`, `mine`, `latest`) in plain words and ask the user which to
  keep. Never choose for them. Call `tidigar_resolve_merge` with the same plan
  `id`, original `revision` and complete edited `project` sent to the update,
  plus `choices` mapping every conflict ID to `mine` or `latest`. Remote MCP
  keeps no pending merge file. If new conflicts appear, ask about those and
  resend all choices until resolved.
- `stale_revision`: get the current plan again, compare it with the version
  you read, redo the requested change while preserving others' work, validate
  and save against the new revision. Ask about incompatible changes.
- `write_unknown` or a lost response to a write: the save may have happened.
  Read the plan and compare the stored result before attempting another write.
  If the result cannot be established, report the uncertainty; do not retry
  blindly or claim success.

## Access failures

- `insufficient_scope`: the OAuth grant is read-only. Ask the host to authorize
  the connection again with **Read and write**, then check `tidigar_status` and
  reread the plan before saving. The host handles the MCP authorization challenge.
- `invalid_token` or an expired or revoked connection: let the host refresh or
  reconnect through OAuth, then check status and reread the plan. A user who
  declined authorization has not approved a different access method.
- `agent_access_off`, insufficient membership or `subscription_required`:
  explain the actual restriction. A write grant cannot override membership,
  subscription or the organisation owner's policy. Do not switch credentials
  or protocols to bypass it.
- `no_such_plan`: check the selected organisation and plan link with the user.
- `rate_limited`: respect `retryAfter`. After an uncertain write, read before
  any retry.

## Create, delete or restore a stored plan

- **Create:** use the [plan JSON reference](https://tidigar.com/agents/plan-json.md)
  for a new plan only. Call `tidigar_validate_plan` with `plan`, then
  `tidigar_create_plan` with the returned `project` so its ID stays stable.
  Return the saved plan's `url`. If creation's result is unknown, list/read and
  compare that ID before retrying. `plan_exists` is not permission to duplicate
  it; use `newId: true` only when the user asks for a new copy.
- **Delete:** only when requested, confirm by plan name first. Read its current
  revision and call `tidigar_delete_plan` with `id` and `revision`. It moves to
  trash for 30 days. On `stale_revision`, read again and ask again.
- **Restore:** call `tidigar_list_trash`, identify the requested plan, then
  `tidigar_restore_plan` with its `id`.

## Screens and stories

A screen publishes one saved view to anyone holding its link, without an
account. Confirm with the user before creating one or permanently ending one.
Use `tidigar_list_screens`, `tidigar_create_screen`, `tidigar_update_screen`,
`tidigar_get_screen_link` and `tidigar_delete_screen`. A screen's `view` is the
saved view ID in the project's `sharedViews`; keep that ID when changing what
it shows. Deleting the view ends the screen. Give a screen link only to the
user, never put it in a project, file or public place. `agent_screens_off`
means the owners reserve making screens and retrieving links for people.

For stories, read the [story language](https://tidigar.com/agents/docs/stories.md)
and use the plan's titles and dates. To replay schedule versions from status
meetings, read all versions first and match activities by meaning. Keep the
latest version as the stored plan. At `0:00`, set its first version without
animation with `hide`, `update`, `add` and `today`. Give each later meeting a
moment four to six seconds apart with its changes and a caption explaining
what changed. End on the stored version and `loop()`. The plan-history pattern
is in the story reference. Fix every returned `storyWarnings` entry and update
the screen until none remain before returning its link.

## Remote MCP arguments

Use the host's tool calls, not shell commands. Fields marked `?` are optional;
validation and creation take exactly one of `plan` or `project`. The tool
schemas supplied by the server define field types and limits.

| Tool | Arguments |
| --- | --- |
| `tidigar_status` | none |
| `tidigar_list_plans` | none |
| `tidigar_get_plan` | `id` |
| `tidigar_validate_plan` | `plan?`, `project?` |
| `tidigar_update_plan` | `id`, `revision`, `project`, `merge?` |
| `tidigar_resolve_merge` | `id`, `revision`, `project`, `choices` |
| `tidigar_create_plan` | `plan?`, `project?`, `newId?` |
| `tidigar_delete_plan` | `id`, `revision` |
| `tidigar_list_trash` | none |
| `tidigar_restore_plan` | `id` |
| `tidigar_list_screens` | `id` |
| `tidigar_create_screen` | `id`, `view`, `name?`, `story?`, `joinCode?` |
| `tidigar_update_screen` | `id`, `screen`, `name?`, `story?`, `joinCode?` |
| `tidigar_get_screen_link` | `id`, `screen` |
| `tidigar_delete_screen` | `id`, `screen` |
