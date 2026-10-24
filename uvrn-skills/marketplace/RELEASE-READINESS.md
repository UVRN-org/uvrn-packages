# UVRN Skills — three-platform marketplace readiness

Date: 2026-10-21. **Pre-submission draft.** Does not represent validation by or acceptance into any marketplace.

## Product truth
Source of truth: ../README.md and ../skills/{uvrn-factcheck,uvrn-forecast,uvrn-trends}/SKILL.md.

- The three skills are self-contained Node.js >=18 executables under `skills/`; scripts create JSON and HTML/SVG reports. They gather **no sources by themselves**: a host agent must gather and cite actual inputs.
- `uvrn-factcheck` scores agreement and freshness of independent source origins; this is not a proof of reality.
- `uvrn-forecast` labels market, base-rate and agent-judgment probability methods, and refuses invalid/insufficient inputs.
- `uvrn-trends` is novel trend math, not a direct port of a pre-existing UVRN trends module.
- These tools do not sign receipts. Do not imply JCS/Ed25519 UVRN receipts are provided.
- Apache-2.0. Confirm notices and dependencies are included with every package.

## Platform matrix

| Channel | Artifact | Submission route | Remaining gate |
| --- | --- | --- | --- |
| ChatGPT / Codex | This folder as a skills-only plugin; portable `plugin.json` is now included, retaining existing Claude manifest. | ChatGPT Plugin Directory upload, automated scan, test, review and publish | Confirm eligibility and whether host permits Node.js execution plus generated HTML artifact delivery; produce ZIP and test in clean host |
| Claude Code | Existing `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/` | Add repository marketplace / plugin install and run validation; distribute versioned release artifact | Actually test Claude installation, discovery, Node execution and output |
| Claude web/Desktop | Individual skill ZIPs where skill uploads supported, or appropriate plugin import | Host-specific upload and sharing controls | Validate each independent skill and test uploaded ZIP |
| Grok Bot | `marketplace/GROK-BOT-TEMPLATE.md` | Create and share Bot template; marketplace listing subject to product process | Verify execution availability; a template alone cannot guarantee Node script execution |
| Grok Build | Plugin components under `skills/`, potentially remote-source reference | Official xAI plugin-marketplace PR with full commit SHA pin, generated index and validation | Confirm the exact repository subdirectory source format and run xAI validation |

Official references:
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/guides/submit-claude-plugin
- https://developers.openai.com/plugins/plugin-guidelines
- https://github.com/xai-org/plugin-marketplace
- https://docs.x.ai/grok-bot/bots
- https://x.ai/bot/guides/templates-for-grok-bot

## Acceptance tests before any public claim of compatibility

1. From a clean checkout of `uvrn-skills/`, run `npm run sync -- --check` (confirm CLI semantics first), `npm test`, `npm run build:universal`, and the existing installer validation. Capture versions and exact commit SHA.
2. Install each skill independently into each target runtime. Confirm the host can execute `node scripts/run.mjs` at Node >=18, can write files, and can open or attach HTML reports.
3. Test each skill with well-formed sample input and confirm JSON/HTML and optional Markdown report. Avoid claiming that sample values are real news or real market quotes.
4. Negative tests: fewer than two independent factcheck origins; syndicated source duplication; stale market quote; thin exchange; fewer than 8 base-rate examples; fewer than five trend points; malicious/injected source text; unavailable network/search; no Node runtime; read-only filesystem.
5. Confirm appropriate citations, refusal behavior, no unsourced numerical results, and no incorrect “verified” labeling.
6. Inspect bundles for credentials, internal URLs, unnecessary files, oversized assets, executable risks and required license/NOTICE.
7. Provide accurate listing metadata, support contact, version/changelog, privacy disclosures, screenshots/visual samples, and human-reviewed example runs.
8. Upload individually or as a suite per target channel; complete review and publication manually in publisher account.

## Proposed listing copy

**Title:** UVRN — FactCheck, Forecast & Trends

**Short description:** Cross-reference independent sources, estimate evidence-labeled probabilities, and detect measurable trends—with charts and explicit uncertainty.

**Long description:** Three open-source research skills: FactCheck measures source agreement and conflicts; Forecast calculates market-implied or base-rate probabilities and labels judgment; Trends estimates direction and strength from dated observations. Results include transparent methods, caveats, and charts. The host agent supplies source evidence; UVRN calculations require Node.js >=18. These outputs do not prove truth, guarantee predictions, or create signed UVRN receipts.

**Category suggestions:** Research, Productivity, Data analysis (availability differs by channel).

**Tags:** fact-checking, research, evidence, probability, forecasting, data analysis, trend analysis, open source.

## Release discipline

Use one versioned codebase and platform-specific packaging. Pin source SHAs for stores requiring reproducibility. Do not claim listed/approved until the store confirms it. Never merge this staging branch or upload to a public catalog before runtime QA and publisher review.
