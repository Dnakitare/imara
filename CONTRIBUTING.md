# Contributing to Imara

Thanks for your interest in contributing to Imara!

## Development Setup

```bash
git clone https://github.com/dnakitare/imara.git
cd imara
pnpm install
pnpm build
```

## Project Structure

This is a pnpm monorepo with turborepo. Each package is in `packages/`:

- `core` — Shared types, schemas, hash utilities
- `store` — Audit event storage (SQLite)
- `policy` — Policy evaluation engine
- `proxy` — MCP proxy server
- `cli` — CLI tool (`imara` command)
- `dashboard` — Next.js web dashboard

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `pnpm build` to verify everything compiles
4. Run `pnpm test` to run tests
5. Open a pull request

## Code Style

- TypeScript strict mode
- ES modules (`"type": "module"`)
- Prefer simple, readable code over clever abstractions

## Reporting Issues

Open an issue on GitHub. Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, pnpm version)

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
