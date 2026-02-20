# diffmut

LLM-powered mutation testing for pull requests.

## Project hints

- Factorize common code.
- Split big classes and methods into smaller parts.
- Add at least one relevant test when fixing a bug.

## Toolchain

- **npm** — package manager. Run `npm install` to bootstrap.
- **tsup** — TypeScript bundler. Run `npm run build` to compile.
- **vitest** — test runner. Run `npm test` to execute tests.
- **eslint** — linter. Run `npm run lint` to check code style.
- **tsc** — TypeScript compiler. Run `npm run typecheck` for type checking.

## Verification checklist

Run before considering any work done:

```bash
npm run typecheck        # Type checking
npm run lint             # Linting
npm test                 # Tests (45 tests)
npm run build            # Build
```
