# Checklist: uvrn landing repo (Option A)

Use the **uvrn** repo as a lightweight landing page that points to **uvrn-packages**.

---

## Before you push uvrn-packages

- [ ] **No secrets** — No `.env`, keys, or tokens in the repo (`.gitignore` already excludes `.env` and `.env.*`; double-check nothing sensitive was ever committed).
- [ ] **Landing README** — `docs/uvrn-landing-README.md` is the copy for the uvrn repo (title: **UVRN — Universal Verification Receipt Network**).
- [ ] **Consistent wording** — Root `README.md` and this checklist use "Universal Verification Receipt Network."
- [ ] **Remote** — `git remote -v` points to `https://github.com/UVRN-org/uvrn-packages.git` (or your fork). Push: `git push origin main` (or your branch).

---

## 1. Content for the uvrn repo

- Copy the contents of **`docs/uvrn-landing-README.md`** (in this repo) into the README of [github.com/UVRN-org/uvrn](https://github.com/UVRN-org/uvrn).

**How:**

- Open [UVRN-org/uvrn](https://github.com/UVRN-org/uvrn) → **Code** → **README.md** → edit (pencil) → paste the landing README → commit.
- Or clone `git clone https://github.com/UVRN-org/uvrn.git`, replace `README.md` with the content of `docs/uvrn-landing-README.md`, then commit and push.

## 2. Optional: GitHub repo settings for uvrn

- **Description:** e.g. `Universal Verification Receipt Network — open protocol for verifiable receipts. Main repo: uvrn-packages`
- **Topics:** e.g. `uvrn`, `verification`, `receipts`, `delta-engine`, `open-source`

## 3. Optional: GitHub repo settings for uvrn-packages

- **Description:** e.g. `UVRN protocol monorepo — core, SDK, CLI, API, MCP, DRVC3 adapter. Published as @uvrn on npm.`
- **Topics:** e.g. `uvrn`, `verification`, `receipts`, `typescript`, `npm-package`

## 4. Done

- **uvrn** = short, memorable landing page.
- **uvrn-packages** = where development and npm metadata stay; no URL changes needed.
