# Tidigar skill

The Tidigar skill lets an AI agent make roadmaps, Gantt charts and project
timelines as [Tidigar](https://tidigar.com) share links: one URL that opens
the plan as an editable timeline. No account, API key or upload is involved.

This repository is generated from Tidigar's sources and published as they
change. Report problems to hello@tidigar.com rather than opening pull
requests here.

## Install

Claude Code, as a plugin from this marketplace:

```sh
claude plugin marketplace add jacobhama/tidigar-skill
claude plugin install tidigar@tidigar
```

Codex, as a plugin from this marketplace:

```sh
codex plugin marketplace add jacobhama/tidigar-skill
```

Then install Tidigar from the plugin list.

ChatGPT and Claude apps: upload
[tidigar-skill.zip](https://tidigar.com/agents/tidigar-skill.zip) as a skill.

Agents without skills read [tidigar.com/llms.txt](https://tidigar.com/llms.txt).

## Contents

- `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`:
  the Claude Code and Codex marketplaces, each listing the one plugin.
- `plugins/tidigar/.claude-plugin/plugin.json` and `plugins/tidigar/plugin.json`:
  the plugin's manifests for Claude Code and for Codex and ChatGPT.
- `plugins/tidigar/skills/tidigar/`: the skill, with `SKILL.md`, the
  reference module under `scripts/`, the examples and the share link
  specification.

More for agents: [tidigar.com/agents](https://tidigar.com/agents).

## License

MIT, see [LICENSE](LICENSE). The Tidigar name and logo are not licensed.
