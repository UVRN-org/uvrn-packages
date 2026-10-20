# Install prompt (any AI)

Paste the prompt below into any AI agent that can read files and, ideally, run a shell. It asks the
agent to check its own environment first and take only the path that matches it. It has been tried in
Grok and ChatGPT; Claude can also use the native plugin paths in [../README.md](../README.md).

The text between the lines is the prompt. Keep it in sync with the copy on uvrn.org/skills.

---

Install the uvrn-skills (uvrn-factcheck, uvrn-forecast, uvrn-trends).

Source of truth: the uvrn-skills folder in https://github.com/UVRN-org/uvrn-packages (main branch). Treat that folder's README and universal/README.md as authoritative for packaging, structure and usage.

Environment check (do this first): tell me what agent or runtime you are, whether you have a shell, whether Node 18 or newer is available, and where user or custom skills are stored on this system, if anywhere. Then follow only the path that matches your actual capabilities. Do not assume Claude Code, Claude Desktop or any specific plugin CLI.

Preferred path (you have a shell and can write to a skills directory):
1. Clone the repo, or use my existing clone if I give you a path.
2. Read uvrn-skills/README.md and uvrn-skills/universal/README.md. The three skill folders are under uvrn-skills/skills/.
3. Install the three skills into your skills directory: run `node uvrn-skills/scripts/install.mjs --dest <your skills directory> --check`, or copy the three self-contained folders yourself (each has SKILL.md, lib/ and scripts/). Install nothing else from the repo.
4. Confirm the skills are discoverable: they appear in your skill list, or you can read their SKILL.md files and run the included scripts/run.mjs.
5. Report exactly what you did and where the skills landed.

Fallback path (no shell, or no persistent skills directory):
1. Fetch the uvrn-skills folder if you can, or read it on GitHub.
2. Give me the exact commands or steps to run locally to get the three skills (or one skill) into my environment.
3. If a zip is the right distribution for you, tell me its exact contents and the build command from universal/README.md (npm run build:universal). Do not build or unzip anything unless I ask.
4. Summarize the manual install steps for my interface.

Verify: after installing, confirm the three skills are available, or ask me for a short claim to fact-check as a live test. State exactly what you confirmed.

Rules:
- Install only the three uvrn skills.
- Prefer the self-contained skill folders; each runs with Node 18 or newer via scripts/run.mjs.
- If any step fails, stop and show me the exact error instead of guessing or saying it worked.
- Be explicit about which steps are Claude-specific and which work anywhere.

---
