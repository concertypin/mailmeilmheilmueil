# Follow-up TODO

## Backend integration

- [ ] Replace FakeRepository test helpers with a real test Firestore instance
- [ ] Define server-side SMTP transport for actual mail delivery (currently compose persists only)
- [ ] Decide whether compose should verify IMAP credentials before accepting (currently accepts any valid Basic header)
- [ ] Add server-side Bcc filtering for API responses (currently Bcc is visible to all authenticated users)

## Development workflow

- [ ] Add end-to-end smoke test for `/api/compose` with mock fetch
- [ ] Consider consolidating the three sidebar inbox-badge filters into a shared hook

## Documentation

- [ ] Keep `AGENTS.md` aligned with new features as they land
- [ ] Consider a top-level `ARCHITECTURE.md` covering the Hono/Firestore/IMAP/Compose data flow

## Review follow-up

- [ ] Revisit the unresolved Firestore subscription, review API, and development-server review comments when backend integration resumes
- [ ] The comment about Firestore `ignoreUndefinedProperties` should be resolved at initialization time rather than handled per-route with `?? []`
