# Work on plans stored in Tidigar

Use this guide when a user asks to save, find, open or change a plan stored in
Tidigar or Tidigar Server, or gives a `/p/<code>` link. A public chat
assistant uses remote MCP with delegated OAuth authorization. The user's
consent grants access; reading this guide or installing the skill does not.

A stored plan is the original shared project. A `#s=…` or `#t=1;…;e` link is an
independent copy. Do not replace a requested save or update with a share link.
If the destination is unclear, ask whether the user means the stored original
or a separate copy before writing.

## Connect through remote MCP

1. Discover the Tidigar tools available in the assistant's host, including tools
   that the host loads on demand. Call `tidigar_list_plans` with no arguments to
   inspect `server`, `organization`, `scope`, `role`, `writable` and existing
   plans. Proceed with a write only when `writable` is true; otherwise follow
   the access-failure guidance below. Do not infer authorization from a plan URL.
2. If no Tidigar connection exists, use the host's connector setup flow when it
   supports connecting during the conversation. Otherwise guide the user to add
   an MCP connection in the assistant's app or connector settings. The address
   is `https://app.tidigar.com/mcp`; for Tidigar Server it is the user's server
   origin followed by `/mcp`. See
   [connection setup](https://tidigar.com/agents/cloud#a-chat-assistant).
3. Let the host's MCP client handle OAuth discovery and authorization. It opens
   Tidigar for the user to sign in, check the assistant's name and return
   address, choose the organisation, and approve **Read only** or **Read and
   write**. Request writing only when the task changes stored data. Consent must
   come from the user, never from the agent acting on their behalf.
4. After authorization completes, discover the tools again and call
   `tidigar_list_plans`. Call `tidigar_guide` any time you want the full domain
   model or step-by-step workflow recipes.

The host keeps access and refresh tokens outside the conversation. Never ask
for personal tokens, passwords or OAuth codes in chat, and never put them in
prompts, files or shell commands. Coding agents with separately configured
credentials use the [CLI and HTTP reference](https://tidigar.com/agents/stored-plans-cli.md).

## Create and edit plans

- **Start with a shell (recommended for screenshots, voice, and new plans):**
  call `tidigar_create_plan` with `{ plan: { name, dimensions?, workDays? } }`
  to get the plan `id`, `revision` and live `url` immediately.
- **Populate and edit incrementally:** call `tidigar_edit_plan` with `id` and
  only the dimensions, activities, milestones, periods, dependencies (by `key`,
  `title`, `ref` or ID) or view settings you want to add, update or remove.
  Soft issues (such as a successor starting on the same day its predecessor ends
  or non-25% progress values) are adjusted automatically and returned in
  `adjustments`; dependency cycles and unknown references are rejected.
- **Read a plan:** call `tidigar_get_plan` with `id`. By default it returns a
  compact, human-readable plan view (`format: "readable"`). Pass `format: "raw"`
  only if you need the canonical `tidigar-project` JSON.
- **Delete or restore:** confirm by plan name first, then call
  `tidigar_delete_plan` with `action: "delete"`, `id` and `revision` (moves to
  30-day trash). List trash with `tidigar_list_plans({ includeTrash: true })`
  and recover with `tidigar_delete_plan({ action: "restore", id })`.

## Baselines and status reports

Use `tidigar_baseline` with `action: "create" | "activate" | "delete"`, `id`
and `revision`. Pass `name` for a named baseline, or omit `name` on the first
baseline to also create a Follow-up List view. `baselineId` and `capturedAt`
are optional on creation.

## Tickets and comments

1. Find work with `tidigar_work` (`action: "mine"` for your open assignments,
   `"search"` to filter by plan, `ref`, `prefix`, `unassigned`, `dated`,
   `progress`, dates or dimension, and `"get"` to inspect one ticket with its
   Markdown description, comments, history and completion blockers). You may
   omit `id` on `"get"` to look up a ticket by `ref` across accessible plans; if
   multiple plans match, `ambiguous_activity` lists all `candidates`.
2. Claim, assign, update progress or complete work with `tidigar_edit_plan`
   (`update: [{ target, claim?, takeOver?, assignee?, progress?, ... }]`).
   Never set `takeOver: true` unless the user explicitly asks.
3. Post Markdown result comments and `@mentions` with `tidigar_comment`
   (`action: "add"` or `"list"`).

## Sharing, Christmas tree cards and screens

- For stored plans, return the plan's short `url` (`/p/<code>`).
- To generate a compact, chat-safe `#s=…` share link for an independent copy,
  a Christmas tree card (`tree`) or a `drive` link, call `tidigar_share` with
  `kind: "copy" | "tree" | "drive"` and either `id` or `plan`. Return the exact
  `url` verbatim.
- To manage live public wall screens (`kind: "screen"`, `action: "list" |
  "create" | "update" | "delete" | "link"`), confirm with the user before
  creating or permanently deleting a screen. Fix every `storyWarnings` entry
  before returning a screen link.

## Access failures

- `insufficient_scope`: the OAuth grant is read-only. Ask the host to authorize
  the connection again with **Read and write**.
- `invalid_token`, `agent_access_off`, `subscription_required`, `no_such_plan`,
  `rate_limited`: report the actual restriction; never try to bypass it.

## Remote MCP arguments

Use the host's tool calls, not shell commands. Fields marked `?` are optional.
The tool schemas supplied by the server define field types and limits.

| Tool | Arguments |
| --- | --- |
| `tidigar_guide` | `topic?` |
| `tidigar_list_plans` | `includeTrash?` |
| `tidigar_get_plan` | `id`, `format?` |
| `tidigar_create_plan` | `plan?`, `project?`, `newId?` |
| `tidigar_edit_plan` | `id`, `revision?`, `name?`, `description?`, `workDays?`, `costCurrency?`, `costUnit?`, `dimensions?`, `add?`, `update?`, `remove?`, `view?` |
| `tidigar_delete_plan` | `action`, `id`, `revision?` |
| `tidigar_baseline` | `action`, `id`, `revision`, `name?`, `baselineId?`, `capturedAt?` |
| `tidigar_share` | `kind`, `action?`, `id?`, `plan?`, `view?`, `screen?`, `name?`, `story?`, `joinCode?` |
| `tidigar_work` | `action`, `id?`, `target?`, `ref?`, `prefix?`, `progress?`, `dated?`, `from?`, `through?`, `dimension?`, `value?`, `assignee?`, `unassigned?` |
| `tidigar_comment` | `action`, `id`, `activity`, `body?`, `before?` |
