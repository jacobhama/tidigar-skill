# Tidigar skill

The Tidigar skill lets an AI agent make roadmaps, Gantt charts and project
timelines as [Tidigar](https://tidigar.com) share links: one URL that opens
the plan as an editable timeline. No account, API key or upload is involved.

This repository is generated from Tidigar's sources and published as they
change. Report problems to hello@tidigar.com rather than opening pull
requests here.

## Install

Codex, as a plugin from this marketplace:

```sh
codex plugin marketplace add jacobhama/tidigar-skill
```

Then install Tidigar from the plugin list.

Codex or Claude Code, as a skill:

```sh
curl -sLO https://tidigar.com/agents/tidigar-skill.zip
unzip -o tidigar-skill.zip -d ~/.agents/skills   # Codex
unzip -o tidigar-skill.zip -d ~/.claude/skills   # Claude Code
```

ChatGPT and Claude apps: upload
[tidigar-skill.zip](https://tidigar.com/agents/tidigar-skill.zip) as a skill.

Agents without skills read [tidigar.com/llms.txt](https://tidigar.com/llms.txt).

## Contents

- `.agents/plugins/marketplace.json`: the marketplace, listing one plugin.
- `plugins/tidigar/plugin.json`: the plugin manifest.
- `plugins/tidigar/skills/tidigar/`: the skill, with `SKILL.md`, the
  reference module under `scripts/`, the examples and the share link
  specification.

More for agents: [tidigar.com/agents](https://tidigar.com/agents).
