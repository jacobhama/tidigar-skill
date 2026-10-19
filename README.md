# Tidigar skill

Plan with your AI assistant in [Tidigar](https://tidigar.com). Create a plan
as a share link without a Tidigar account, or connect your assistant to read
and update plans in Tidigar Cloud or Tidigar Server.

A share link carries a separate copy of the plan. A Cloud plan is saved for
your organisation, and changes appear for everyone who opens it. See
[Connect your AI assistant](https://tidigar.com/agents/cloud) for setup.

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
[tidigar-skill.zip](https://github.com/jacobhama/tidigar-skill/raw/refs/heads/main/tidigar-skill.zip) as a skill.

Agents without skills read [tidigar.com/llms.txt](https://tidigar.com/llms.txt).

## Contents

- `tidigar-skill.zip`: the standalone skill for manual upload.
- `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`:
  the Claude Code and Codex marketplaces, each listing the one plugin.
- `plugins/tidigar/.claude-plugin/plugin.json` and `plugins/tidigar/plugin.json`:
  the plugin's manifests for Claude Code and for Codex and ChatGPT.
- `plugins/tidigar/skills/tidigar/`: the skill, with `SKILL.md`, the
  reference module under `scripts/`, the examples and the share link
  specification.

More for agents: [tidigar.com/agents](https://tidigar.com/agents).

## License

MIT, see [LICENSE](LICENSE), except the share link specification in
`references/share-links.md`, which is
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Tidigar name
and logo are not licensed.
