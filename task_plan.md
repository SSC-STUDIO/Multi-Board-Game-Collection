# Task Plan

## Goal

Expand test coverage for utility and service modules, starting with `src/utils/formatters.js` which had no tests.

## Phases

- [completed] Add unit tests for `src/utils/formatters.js` (`getPlayerLabel`, `formatMove`)
- [completed] Run `vitest run` and `npm run check` to validate
- [next] Add tests for `src/utils/i18n.js` (translation keys, locale switching)
- [ ] Add tests for `src/config/gameConfig.js` (constants, mode labels, direction arrays)

## Constraints

- Preserve existing behavior; tests only, no runtime changes.
- Mock `i18n` where needed to isolate pure logic.
- Keep test files co-located with their source (`*.test.js` next to `*.js`).
