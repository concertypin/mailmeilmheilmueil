# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.
All agents, such as Claude Code, should keep `**/AGENTS.md` in mind.

## Project Type

This is a **React SPA** built with Vite. It uses `@vitejs/plugin-react` (no Preact compatibility layer). The frontend always calls the Hono/Firestore API for mail data. On-demand IMAP synchronization uses Basic authentication stored in sessionStorage. Real external IMAP and AI provider credentials remain deployment configuration, not repository content. A custom Vite plugin copies `index.html` to route directories at build time for HTTP static hosting and GitHub Pages fallback.

## Development Commands

```bash
# Start development server with HMR
pnpm dev

# Build for production (outputs SPA to dist/)
pnpm build

# Format code
pnpm format

# Lint code
pnpm lint

# Run tests (Vitest with browser and node environments)
pnpm test
```

## Architecture

- **Entry point**: `src/index.tsx` — Mounts the app using `createRoot` from `react-dom/client` and renders the Wouter route switch.
- **Routing**: Uses `wouter` with browser History API routes for `/`, `/inbox`, `/contacts`, `/compose`, and `/mails/:mailId`. Review UI is entered via `/mails/:mailId?mode=review`. The frontend is served over HTTP; `file://` navigation is intentionally unsupported.
- **Build plugin**: A custom Vite plugin (`spaCopyPlugin` in `vite.config.ts`) copies `dist/index.html` to `dist/404.html` for GitHub Pages fallback.
- **ES modules** throughout (`"type": "module"` in package.json)
- **Output format**: Generates SPA files in the `dist/` directory with relative asset paths (`base: "./"`).
- **Type definitions**: TypeScript throughout with `@types/react`.
- **Testing**: Uses `@testing-library/react` with `jsdom` environment for component rendering tests, and standard Vitest for Node.js unit tests. `@testing-library/user-event` provides realistic user interaction simulation.
- **Linting**: Uses oxlint with the native `react` plugin (Rust, not ESLint bridge). React-specific rules like `react/jsx-key`, `react/rules-of-hooks`, and `react/exhaustive-deps` are configured in `scripts/linter/oxlint-react.ts` and extended from `oxlint.config.ts`. `react/react-in-jsx-scope` is disabled because Vite uses the automatic JSX runtime.

## Coding Standards

If you can't access the project's convention, such as hono, typescript, typescript-schema, ask user for adding MCP server.
MCP Server:

- Endpoint: https://conventions.aieuroka.workers.dev/mcp (for most clients), https://conventions.aieuroka.workers.dev/with-tool/mcp (for GitHub Copilot, which doesn't support resource retrieval)
- Streamable HTTP, without authentication

## TypeScript Configuration

- **Path alias**: `@/*` maps to `src/*`, `@server/*` maps to `server/src/*`, `@test/*` maps to `tests/*` (configured in `tsconfig.base.json`)
- **Project references**: Uses `tsconfig.json` with `app` and `node` references
- **Strict mode** enabled
- **JSX**: Set to `"preserve"` with `"jsxImportSource": "react"`.

## Package Manager

This project uses **pnpm**.

## Deployment Notes

- Deployment uses a Linux VM with a systemd-managed Node/Hono service and Nginx. Keep hostnames, IP addresses, service paths, and tunnel URLs out of public documentation unless they are intentionally public.
- Cloudflare Quick Tunnel URLs are temporary and have no uptime guarantee. A stable hostname requires a Cloudflare named tunnel and a domain managed by Cloudflare.
- A tunnel should forward only to the local HTTP web server. Do not expose the Hono API or SMTP listener directly when using a tunnel.
- The SMTP test listener intentionally binds to `127.0.0.1:2525` and is unauthenticated. It is only for the VM-local `pnpm demo:send-sample` command; never open port 2525 to the public internet without adding authenticated TLS SMTP ingress, rate limiting, and sender validation.
- Cloud Firestore rules are deployed for fictional prototype data. Browser reads are currently public, while browser writes are denied. If real mail is ever stored, replace this prototype policy with authenticated, least-privilege rules before deployment.
- The Firebase Admin service account must remain outside the application tree with restrictive permissions. Never copy it into the repository, include it in deployment archives, or print its contents.
- Keep `.env`, Firebase credentials, Codex credentials, and other secrets out of source control and chat transcripts. Codex authentication files must be treated like passwords.
- After changing application files, rebuild and upload the application, install dependencies when the lockfile changes, restart the service, and verify both the local health endpoint and public web endpoint.
- The VM host firewall should use default-deny incoming rules. Only required SSH and web ports should be allowed; SMTP and internal API ports must remain loopback-only.
- The current prototype does not use any browser API that requires a secure context. Do not add or depend on HTTPS-only browser APIs (such as Web Crypto `crypto.subtle`, Service Workers, Geolocation, WebAuthn, or Push APIs) while the direct-IP HTTP deployment is in use; migrate to HTTPS first if that requirement changes.
- Small VMs may need swap for dependency installation. Avoid running emulator, build, and AI workloads concurrently unless memory use is monitored.
