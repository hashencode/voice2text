# Architecture

## Directory Responsibilities

- `app/`: Expo Router route entry files. Keep route wiring and page composition here.
- `features/`: Feature-scoped UI, hooks, and local data shaping logic.
- `components/ui/`: Reusable presentational primitives with no product-specific behavior.
- `components/layout/`: Shared app-level layout shells.
- `data/`: Persistent data access and repositories (SQLite/MMKV clients, repositories, and domain services).
- `modules/`: Native/expo module bindings.
- `scripts/`: Local developer scripts and tooling helpers.
- `theme/`: Design tokens and theme provider.
- `utils/`: Pure utilities (stateless helpers).

## Dependency Rules

```text
app -> features -> (components/ui, components/layout, hooks, theme, data, utils)
components/ui -> (theme, utils)
components/layout -> (components/ui, hooks, theme)
features -> (data, modules, utils) when required
data -> (utils)
```

## Guardrails

- Avoid importing `features/*` from `components/ui/*`.
- Keep business logic out of `app/*`; place it in `features/*`.
- Prefer feature-local hooks in `features/<name>/hooks/*` over global `hooks/*` unless cross-feature reuse is proven.
- Avoid adding root-level `services/*`; keep domain logic in `features/*` or `data/*`.

## Migration Note (2026-04-08)

Phase 1 completed:

- `components/home` -> `features/home`
- `components/editor` -> `features/editor`

## Hook Placement Rule

- `hooks/*`: cross-feature hooks only (theme, platform, interaction primitives).
- `features/<name>/hooks/*`: hooks with clear feature ownership.

Current split:

- moved to feature: `features/record/hooks/useWavRecording.ts`
- kept global: `useColor`, `useColorScheme`, `useKeyboardHeight`, `use-file-picker`, `use-mode-toggle`, `use-recording-recovery`, `use-bottom-tab-overflow`, `use-overlay-interaction-lock`
