# AGENTS Rules (Expo Project)

## Expo Knowledge Source Priority

For Expo/React Native coding tasks, always prefer Expo's LLM-friendly docs before general web search:

1. SDK-versioned docs matching this project first (for this repo, Expo 55): `https://docs.expo.dev/llms-sdk-v55.0.0.txt`
2. `https://docs.expo.dev/llms.txt` (index/navigation)
3. `https://docs.expo.dev/llms-sdk.txt` (latest SDK, for cross-checking recent changes)
4. `https://docs.expo.dev/llms-eas.txt` (EAS)
5. Per-page markdown with `/index.md` suffix, for example:
   `https://documentation.expo.dev/develop/development-builds/create-a-build/index.md`

If a statement depends on version behavior, verify against the relevant Expo doc page and state the exact SDK/EAS version context.

To reduce repeated network access, local cache of Expo docs is allowed. Refresh the cache when SDK/EAS version changes, when version-sensitive behavior is involved, or when the cached content may be stale.

## Additional Skills

- `compound-engineering`: Use when setting up or maintaining the Compound Engineering memory loop (`PROFILE.md`, `ACTIVE.md`, `LEARNINGS.md`, `ERRORS.md`, `FEATURE_REQUESTS.md`) or when wiring memory flow rules through `AGENTS.md`.

## Execution Principles (from CLAUDE.md)

These principles are merged as cross-task behavior guidelines.

### 1. Think Before Coding

- State key assumptions explicitly before implementation.
- If multiple valid interpretations exist, present them instead of picking silently.
- If a simpler approach exists, call it out.

### 2. Simplicity First

- Implement the minimum code needed to solve the requested problem.
- Do not add speculative features, configurability, or abstractions that were not requested.
- Avoid single-use abstractions unless there is clear near-term expansion.
- Keep error handling proportional to realistic failure modes in this project stage.

### 3. Surgical Changes

- Touch only lines directly related to the request.
- Do not refactor or restyle unrelated nearby code without explicit request.
- Match existing local style and conventions.
- Remove only unused code/imports introduced by your own changes.
- If unrelated dead code is found, mention it separately instead of deleting it by default.

### 4. Goal-Driven Execution

- Define concrete, verifiable success criteria for non-trivial tasks.
- For bug fixes, prefer: reproduce first, fix second, verify third.
- For multi-step work, briefly list steps with corresponding verification checks.

## Root Folder Creation Rule

When organizing files and modules:

1. Before creating any new top-level folder in the repository root, confirm with the user first.
2. Prefer existing folders and feature-local colocation by default.
3. If a constant/helper is used by only one file and is tightly coupled to that file's domain, keep it in the same file (or colocated domain file).
4. Extract to a standalone shared file only when it is reused by multiple modules or has clear near-term expansion.

## UI Styling Rule (NativeWind First)

For React Native UI styling in this project:

1. Prefer NativeWind `className` as the default styling approach.
2. If a style can be expressed with NativeWind utilities, do not use inline `style`.
3. Use `style` only for cases NativeWind cannot represent cleanly (for example dynamic runtime values such as computed colors, dimensions, transforms, or animated styles).
4. When `style` is required, keep it minimal and place as much static styling as possible in `className`.

## Parameter Defaults Rule

For function/component calls in this project:

1. If an argument value equals the callee's default value, omit that argument.
2. Pass default-valued arguments only when it improves readability in an exceptional context.
3. In code review, treat "explicitly passing defaults everywhere" as noise and prefer concise calls.

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
