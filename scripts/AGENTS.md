This directory is not a source code for production, but to save config files and scripts related to CI/CD, build, tests, lint, etc.

Key files:

- `linter/oxlint-eslint.ts` / `oxlint-eslint-error.ts` / `oxlint-eslint-warn.ts` : ESLint-compatible rule definitions used by oxlint.
- `linter/oxlint-react.ts` : Native oxlint `react` plugin rules (JSX, hooks) using the `react/*` namespace.
