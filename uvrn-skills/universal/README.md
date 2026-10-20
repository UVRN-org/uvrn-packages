# uvrn-skills for any AI

Three skills (`uvrn-factcheck`, `uvrn-forecast`, `uvrn-trends`) that any agent can use if it can
read a skill folder and run Node 18 or newer. Each skill folder is self-contained: `SKILL.md`
(instructions), `lib/` (the math, zero dependencies) and `scripts/run.mjs` (the runner). Nothing
Claude-specific is needed at run time.

Tried so far: **Grok** and **ChatGPT** (universal path below), **Claude Code** and **Claude Desktop**
(native plugin, see [../README.md](../README.md#install--distribute-claude)).

## Easiest: paste one prompt

Paste [INSTALL-PROMPT.md](INSTALL-PROMPT.md) into your AI. It checks its own environment first
(shell, Node, where skills live), takes only the matching path, and stops on the first error.

## With a shell

```bash
git clone https://github.com/UVRN-org/uvrn-packages.git
node uvrn-packages/uvrn-skills/scripts/install.mjs --dest <your skills directory> --check
```

- Copies only the three skill folders into `<your skills directory>`. Nothing else from the repo.
- Refuses to touch a skill folder that already exists; add `--force` to overwrite its files.
  Nothing is ever deleted.
- `--check` runs each installed copy once on a tiny built-in input and prints `ok` or the exact error.

Or copy `uvrn-skills/skills/uvrn-factcheck`, `uvrn-forecast` and `uvrn-trends` into your skills
directory by hand.

## Without a shell: the zip

```bash
cd uvrn-packages/uvrn-skills && npm run build:universal
```

Builds `dist/uvrn-skills-universal.zip`: the three skill folders, this README, the install prompt,
`NOTICE` and `LICENSE` under one `uvrn-skills/` folder. Upload it wherever your AI accepts a skill or
file bundle. Upload one skill folder on its own if that is all you need.

## Running a skill

Paths are relative to the skill folder:

```bash
node scripts/run.mjs factcheck input.json --out DIR [--md] [--name BASE]
node scripts/run.mjs forecast  input.json --out DIR
node scripts/run.mjs trend     input.json --out DIR
```

Each run writes a JSON result and a self-contained HTML report (text plus an inline SVG chart),
and prints one JSON summary line. The input formats are in each skill's `SKILL.md`.

## What is Claude-specific

Only the packaging: `.claude-plugin/` (plugin + marketplace for Claude Code) and the `.plugin` zip
for Claude Desktop. The skill folders, the math and this universal layer work the same anywhere.

## Honest vocabulary

Reports say "cross-referenced" or "sources agree", never "verified". These are UVRN-style analyses
of the evidence supplied, not signed UVRN receipts.
