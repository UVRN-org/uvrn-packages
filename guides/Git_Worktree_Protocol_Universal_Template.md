# Git Worktree Protocol (Universal Template)

Use this when you need to **make updates safely** while **preserving an older version** in a separate folder on your machine. One repo, one `.git`, multiple working directories (worktrees).

## When to use

- You want to keep the current state of the repo in one directory (e.g. for reference, rollback, or a stable copy).
- You want to do new work in another directory without touching the preserved copy.
- You prefer not to maintain two full clones (worktrees share Git objects).

## Conventions (this repo)

| Role | Directory | Branch / ref | Purpose |
|------|-----------|--------------|---------|
| **Preserved** | `uvrn-packages/` (main clone) | `main` or tag `stable/YYYY-MM-DD` | Frozen copy; open/run the “old” version here. |
| **Active** | `uvrn-packages-next/` (worktree) | `feature/updates` or your branch | All new edits and commits go here. |

Branch and tag names are examples; adjust per release or project.

## One-time setup (preserve current, start new work)

Run from the **main clone** (e.g. `uvrn-packages/`):

1. **Ensure working tree is clean**  
   `git status` — commit or stash any local changes.

2. **Tag the current state** (optional but recommended)  
   ```bash
   git tag stable/2026-03-16
   ```  
   Use today’s date or a version-like tag (e.g. `stable/v1.0.0`). This lets you restore the “preserved” state later with `git checkout stable/2026-03-16`.

3. **Create the active worktree**  
   ```bash
   git worktree add ../uvrn-packages-next -b feature/updates
   ```  
   - `../uvrn-packages-next` = path to the new working directory (sibling of the main clone).  
   - `-b feature/updates` = create and use this branch in the new worktree. Use a different branch name if you prefer.

4. **Use the preserved directory**  
   Leave the **original** `uvrn-packages/` directory on `main` (or checkout the tag). Do **not** do new development here if you want to keep it as the “older version.”

5. **Do all new work in the worktree**  
   ```bash
   cd ../uvrn-packages-next
   ```  
   Edit, commit, and push from here. The preserved directory stays unchanged.

## Day-to-day workflow

- **Preserved copy:** Open or run from `uvrn-packages/` (stays at `main` or at a tag).
- **New work:** Open and work in `uvrn-packages-next/` on `feature/updates` (or your branch).
- **Merge when ready:** From the worktree, merge into `main` (e.g. via PR or local merge), then update the main clone with `git pull` in `uvrn-packages/`.
- **Optional:** After merging, you can delete the worktree and branch:  
  `git worktree remove ../uvrn-packages-next` and `git branch -d feature/updates` (from the main clone).

## Restoring the preserved state

If the main clone was moved off the preserved commit:

```bash
cd uvrn-packages
git checkout main
# or
git checkout stable/2026-03-16
```

## Cleanup (remove the extra worktree)

From the **main clone**:

```bash
git worktree remove ../uvrn-packages-next
git branch -d feature/updates   # if you no longer need the branch
```

If the worktree has uncommitted changes, Git will warn you; commit or stash in the worktree first, or use `git worktree remove --force` only if you intend to discard them.

## Summary

| Step | Command / action |
|------|-------------------|
| Tag current state | `git tag stable/YYYY-MM-DD` |
| Create active worktree | `git worktree add ../uvrn-packages-next -b feature/updates` |
| Do new work | `cd ../uvrn-packages-next` and work there |
| Preserved version | Keep `uvrn-packages/` on `main` or tag; open/run from there |
| Remove worktree | `git worktree remove ../uvrn-packages-next` (from main clone) |

This protocol is repo-agnostic; adapt directory and branch names for other projects.
