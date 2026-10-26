# Documentation and engineering plan

Help teammates change the app without guessing its contracts or breaking existing workflows. Adopt these conventions incrementally; this plan does not claim the whole codebase already follows them.

## Documentation ownership

| Location | Purpose | Update when |
|---|---|---|
| `README.md` | Setup and user workflows | Setup or user behavior changes |
| `docs/README.md` | Documentation map | Documents are added or moved |
| `docs/design.md` | Architecture, decisions, alternatives, limitations | Design decisions change |
| `docs/testing.md` | Commands, coverage and test conventions | Test setup or coverage changes |
| `docs/feature-proposals.md` | Candidate stories and acceptance criteria | Features are proposed or reprioritized |
| `docs/engineering-practices.md` | Team conventions and adoption plan | Practices are agreed or revised |
| `CHANGELOG.md` | Human-readable additions, changes and validation | Each meaningful PR |
| GitHub issues and PRs | Assigned scope, discussion and review evidence | Work is planned and reviewed |

Keep one authoritative explanation per topic and link to it elsewhere. Continue recording decisions in the existing design document; separate ADR files only if navigation becomes difficult.

## Comments and JSDoc

Use JSDoc for shared data structures and functions whose inputs, output, units, mutation or failures need explanation. Plain comments suit simple DOM handlers and short explanations of why a workaround exists. Avoid narrating obvious statements or setting a comment coverage quota.

Start with shared `@typedef` definitions for tables, selections, series and normalized view ranges. As helpers are changed, document contracts for parsers, selection reconciliation and view transformations using `@param`, `@returns` and `@throws` where relevant. Explain whether inputs are modified and whether coordinates are raw values or normalized fractions.

For example:

```js
/**
 * Parse numeric CSV contents, including a header row.
 * @param {string} text - Local file contents.
 * @returns {{columns: string[], rows: number[][]}} Validated numeric table.
 * @throws {Error} If headers, row widths or numeric cells are invalid.
 */
```

JSDoc supplies editor help without a build step. It does not enforce types by itself. Consider `checkJs` in a separate tooling change after contracts are consistent. A generated documentation website is unnecessary for this app's current size.

## Development and review

1. Define the user outcome and acceptance examples in an issue. Distinguish proposed features from agreed scope.
2. Make focused branches and small PRs. Preserve opening `index.html` directly and local-only processing unless a deliberate design change is reviewed.
3. Keep pure logic in `data.js`, `scale.js` and `view.js`, with DOM interactions in `app.js`. Refactor as needed for the task.
4. Add regression tests for fixes and behavior tests for new features. Cover invalid input and state preservation where relevant. Prefer observable outcomes over internal implementation details.
5. Run unit tests and affected browser tests during development, then the full available browser suite before merge. Record commands, results and skipped engines in the PR.
6. Update the owning docs and Unreleased change log in the same PR. Request teammate review and resolve feedback before merging.

Use deterministic fixtures and Playwright assertions rather than timed sleeps. Review behavior, edge cases, readability, test evidence and documentation accuracy.

## Adoption order

- This PR publishes the documentation map, proposed stories, practices, change log and additional regression tests.
- Next changes to shared helpers add accurate JSDoc contracts and types alongside behavior tests.
- A separate tooling PR should agree on CI checks, browser coverage, formatting and linting. CI should install from the lockfile with `npm ci`, install selected Playwright browsers, and run unit/browser checks on PRs. Agree on required checks before enabling branch protection.

Avoid mixing whole-repository formatting or tooling migrations into feature PRs. Keep the process proportionate to the change.
