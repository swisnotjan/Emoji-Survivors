# Dev Retrospective

## Main friction points encountered

1. `file://` browser runs were unstable.
- DOM overlays and some canvas captures behaved inconsistently.
- The Playwright client occasionally hung even after writing screenshots.
- Result: visual verification was slower and noisier than necessary.

2. No local dev server / package scripts.
- Every test run needed an ad-hoc command.
- Scenarios were fragmented across many temporary JSON files and one-off terminal commands.

3. Search tooling was inconsistent on this Windows setup.
- `rg.exe` resolves to a WindowsApps/Codex-bundled path that sometimes throws `Access is denied`.
- That forced fallbacks to raw PowerShell queries mid-iteration.

4. Output organization drifted.
- Verification artifacts were valid, but spread across many ad-hoc directories.
- That made comparison across passes slower than needed.

5. The Codex Playwright client emits a module warning.
- The bundled client script under `C:\Users\san day\.codex\skills\develop-web-game\scripts` is parsed as ESM, but the parent `C:\Users\san day\.codex\package.json` does not declare `"type": "module"`.
- Result: the runs still work, but every playtest prints a avoidable warning and pays a tiny parse overhead.

## What was fixed

1. Added a local static server.
- Use `npm run serve`
- Default URL: `http://localhost:4173`

2. Added repeatable playtest wrappers.
- `npm run playtest:smoke`
- `npm run playtest:skilllab`
- These use `http://localhost` instead of `file://`, which is more reliable for overlays and browser automation.

3. Added local package scripts.
- `npm run check`
- `npm run serve`
- `npm run playtest:smoke`
- `npm run playtest:skilllab`
- `npm run search -- "<pattern>"`

4. Added search fallback wrapper.
- `scripts/search.ps1` tries `rg` first.
- If `rg` is unavailable or throws, it falls back to `Select-String`.

5. Added a dedicated boss/enemy verification entrypoint.
- `npm run verify:bosses`
- This runs a deterministic Playwright check against the local server for:
  - random boss selection
  - new enemy roles
  - new boss archetypes

## Remaining recommendations

1. If we want a much faster verification loop, the next high-value step is a repo-local headed/controlled Playwright harness instead of relying only on the generic Codex client.

2. If the WindowsApps `rg.exe` issue keeps happening globally, the clean fix is to install a normal standalone `ripgrep` binary on `PATH` ahead of the packaged one.

3. If balancing work becomes larger, it is worth extracting combat constants from `app.js` into a dedicated tuning table so iteration stops being line-hunting inside one giant file.

4. The clean fix for the Playwright warning is global, not repo-local.
- Add a minimal `package.json` under `C:\Users\san day\.codex` with `"type": "module"`, or move the client under an already-typed module package.
- I did not change the global Codex install from inside this project, but the cause and the fix are both clear.
