# Multi Board Game Collection Agent Boundaries

## Writable scope
- `src/`
- `tools/`
- `assets/`
- `locales/`
- `docs/`
- `ai/`
- `electron-main.js`
- `electron-preload.js`
- `package.json`
- `vite.config.js`
- `vitest.config.js`

## Mandatory safety boundaries
- Do not silently change established rules or saved-game schemas without compatibility tests.
- Do not enable Node integration or expose unrestricted Electron IPC.
- Do not build, sign, or publish mobile, Steam, or desktop releases automatically.

## Universal restrictions
- Use Hermes Agent only and remain in the bound project Session.
- Never create another writable Agent for this repository.
- Never create repository history, upload changes, discard existing work, or rewrite unrelated files.
- Stop for secrets, irreversible data operations, privileged host changes, cross-project edits, external publishing, or conflicting requirements.

## Controlled publication
- During development revisions, do not commit or push.
- After the fixed Hermes master approves the evidence, the same Worker Session must stage only the approved files, create one normal commit, and push the current branch to its configured upstream.
- Never use `git add .`, `git add -A`, force-push, amend, rebase, reset, clean, checkout, stash, or branch switching.
- If the upstream is missing, authentication fails, or the working tree differs from approved evidence, stop publication and report the exact blocker.

## Task plan gate
- Each task revision owns exactly one detailed file under `ai/task-plans/`. Create it once before source edits, then reuse and update it for all feedback attempts of that revision; never create copies.
- The plan must contain `# Task Plan`, `## Goal`, `## Baseline`, `## Scope`, `## Steps`, `## Verification`, `## Risks`, `## Stop Conditions`, and `## Evidence`, and must be at least 800 UTF-8 bytes.
- Update the same task plan with actual commands, findings, deviations, and final evidence. Generic or retrospective-only plans fail review.
- The task plan is part of the approved task changes and is committed and pushed with the implementation after master review.
