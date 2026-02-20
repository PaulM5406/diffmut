Ship a new release of diffmut. Follow these steps in order:

## 1. Run all checks

Execute the full verification suite from CLAUDE.md:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Stop immediately if any check fails.

## 2. Analyze changes

Run these commands in parallel to understand what changed:

- `git status`
- `git diff`
- `git log --oneline -20`

## 3. Suggest a new version

Read the current version from `package.json`. Propose a semantic version bump:

- **Patch** (0.1.0 → 0.1.1): bug fixes, small tweaks, formatting, docs
- **Minor** (0.1.1 → 0.2.0): new features, new options, new CLI commands
- **Major** (0.2.0 → 1.0.0): breaking changes, config format changes, renamed commands

Ask the user to confirm the version before proceeding.

## 4. Bump version

Update the version in:
- `package.json` — the `"version"` field
- `src/cli.ts` — the `.version()` call

## 5. Update CHANGELOG.md

Add a new section at the top (below the header) following Keep a Changelog format:

```
## [vX.Y.Z] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed
```

Only include sections that have entries. Write concise, user-facing descriptions.

## 6. Stage, commit, and push

- Stage all changed files
- Commit with a short message (under 50 chars, no scope prefix, no Co-Authored-By)
- Push to origin

## 7. Tag and push tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

## 8. Verify release

Check that the Release pipeline triggered:

```bash
gh run list --limit 5
```
