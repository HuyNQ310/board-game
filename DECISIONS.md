# Architectural and Technical Decisions

## DEC-001: Initial Project Scaffolding

- **Date**: 2026-11-27
- **Status**: Accepted
- **Context**: Setting up the project skeleton according to `rules.md` section 3 and section 9.
- **Decision**:
  - The repository is set up with Node.js 20+ requirement and npm workspaces (`shared`, `server`, `client`).
  - Native ES modules (`.mjs` for server/shared, `.js`/`.jsx` for client) are used without TypeScript or additional UI frameworks per spec.
  - Development tools are strictly limited to `eslint` (flat config) and `prettier`. No additional libraries have been added.
  - The root `dev` script runs server and client concurrently using shell background execution (`&`) without introducing third-party task runners like `concurrently`.
