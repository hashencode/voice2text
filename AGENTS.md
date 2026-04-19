# AGENTS Rules (Expo Project)

## Expo Knowledge Source Priority

For Expo/React Native coding tasks, always prefer Expo's LLM-friendly docs before general web search:

1. `https://docs.expo.dev/llms.txt` (index)
2. `https://docs.expo.dev/llms-sdk.txt` (latest SDK)
3. `https://docs.expo.dev/llms-eas.txt` (EAS)
4. Per-page markdown with `/index.md` suffix, for example:
   `https://documentation.expo.dev/develop/development-builds/create-a-build/index.md`

If a statement depends on version behavior, verify against the relevant Expo doc page and state the exact SDK/EAS version context.

## Additional Skills

- `compound-engineering`: Use when setting up or maintaining the Compound Engineering memory loop (`PROFILE.md`, `ACTIVE.md`, `LEARNINGS.md`, `ERRORS.md`, `FEATURE_REQUESTS.md`) or when wiring memory flow rules through `AGENTS.md`.

## Utility File Splitting Rule

When organizing shared logic across `scripts/`, `utils/`, and feature/module folders:

1. `scripts/` must only contain executable scripts (Node/CLI/tooling entrypoints), not app runtime business logic.
2. `utils/` should contain pure, side-effect-light reusable helpers only.
3. If a constant/helper is used by only one file and is tightly coupled to that file's domain, keep it in the same file (or colocated domain file), do not split it into a standalone utility file.
4. Extract into a standalone file only when at least one of these is true:
   - reused by multiple modules, or
   - clear near-term expansion/extension is expected.
5. Prefer clear ownership over micro-fragmentation: avoid splitting files just for stylistic symmetry.

## Compound Engineering (Project Local)

Use project-local memory directory:

- `/Users/studio/Documents/GitHub/voice2text/.agents/memories`

Before starting any task:

1. Read `/Users/studio/Documents/GitHub/voice2text/.agents/memories/PROFILE.md`
2. Read `/Users/studio/Documents/GitHub/voice2text/.agents/memories/ACTIVE.md`
3. Apply them as persistent project memory before analyzing user request

Log only when the result is reusable, non-obvious, or likely to recur.

Evaluate whether to log memory when any of these happen:

1. A command/tool call fails unexpectedly
2. User corrects assumptions, behavior, or terminology
3. Missing capability is requested repeatedly
4. External dependency or runtime behavior differs from expectation
5. A reusable workaround or debugging pattern is found

Write entries by category:

- `/Users/studio/Documents/GitHub/voice2text/.agents/memories/LEARNINGS.md`: reusable learnings and corrections
- `/Users/studio/Documents/GitHub/voice2text/.agents/memories/ERRORS.md`: debugging notes and error patterns
- `/Users/studio/Documents/GitHub/voice2text/.agents/memories/FEATURE_REQUESTS.md`: recurring missing capabilities

Promotion rules:

1. Promote to `/Users/studio/Documents/GitHub/voice2text/.agents/memories/ACTIVE.md` only if stable and useful across tasks
2. Keep `ACTIVE.md` concise; remove stale rules during review
3. Promote to this `AGENTS.md` only when a rule is stable at project policy level or user explicitly asks

Behavior expectations:

- Default to Chinese for memory entries unless user asks otherwise
- Do not log trivial typos or one-off noise
- Prefer concise, action-oriented entries

