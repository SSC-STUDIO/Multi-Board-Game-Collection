# Agent Rules (Auto-loaded, do not remove)

## Git Workflow
- After ANY code change: `git add -A && git commit -m "progress: <summary>" && git push`
- Commit messages: prefix with type (fix/feat/refactor/test/docs/chore)
- Always pull before push: `git pull --rebase origin main`

## Anti-Stop Protocol
- After completing any task, immediately pick the next from TASK.md, .bugs/, or create a new improvement
- Never say "done", "goodbye", or any closing statement
- Never wait for user confirmation — keep going in the same response

## Code Quality
- Write tests for new features
- Run existing tests before committing: `cargo test`, `npm test`, or `pytest`
- Fix warnings and lint errors before commit
- No commented-out code in commits

## Efficiency Rules
- Read only files you need to modify — don't browse entire codebase
- Make focused changes — don't refactor unrelated code in the same commit
- If a task needs >3 file reads, summarize what you know first to save context
