# AGENTS Rules (Expo Project)

## Expo Knowledge Source Priority

For Expo/React Native coding tasks, always prefer Expo's LLM-friendly docs before general web search:

1. `https://docs.expo.dev/llms.txt` (index)
2. `https://docs.expo.dev/llms-sdk.txt` (latest SDK)
3. `https://docs.expo.dev/llms-eas.txt` (EAS)
4. Per-page markdown with `/index.md` suffix, for example:
   `https://documentation.expo.dev/develop/development-builds/create-a-build/index.md`

If a statement depends on version behavior, verify against the relevant Expo doc page and state the exact SDK/EAS version context.

## Skills Usage Preference

When an Expo skill matches the task, use it first:

- `expo-dev-client`
- `building-native-ui`
- `native-data-fetching`
- `expo-cicd-workflows`
- `expo-deployment`
- `upgrading-expo`
- `expo-api-routes`

`gstack-*` skills remain available for review/planning/release flow, but Expo-specific implementation and testing should prioritize Expo skills + Expo docs above.

