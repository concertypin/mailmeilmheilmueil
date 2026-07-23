# Follow-up TODO

현재 프론트엔드는 로컬 목업 데이터로 동작하며, Firestore/API 연동은 후속 작업으로 남겨둔다.

## Backend integration

- [ ] Replace `mockMailItems` in `src/pages/Home.tsx` with a mail repository/data adapter backed by Firestore when backend integration resumes.
- [ ] Restore review-completion persistence through the server API and update Firestore only after the API confirms the operation.
- [ ] Define the backend contract for saving edited promotion drafts together with review completion.
- [ ] Decide whether the frontend workspace state should survive a full page refresh after backend persistence is restored.

## Development workflow

- [ ] Decide whether `pnpm dev` should start the future Hono API server alongside Vite.
- [ ] If so, restore a dedicated server watcher script and the Vite `/api` proxy, then add an end-to-end local API smoke test.
- [ ] Keep API, Firebase, IMAP, SMTP, and AI credentials out of the browser bundle and source control.

## Documentation

- [ ] Update `README.md` to describe the current Wouter routing and frontend-only mock mode.
- [ ] Document the future Firestore/API integration separately from the currently runnable frontend flow.
- [ ] Keep `AGENTS.md` and `README.md` aligned with whether backend integration is enabled in the active branch.

## Review follow-up

- [ ] Revisit the unresolved Firestore subscription, review API, and development-server review comments when backend integration begins.
