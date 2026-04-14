# Import Audio Recognition Test Cases

## Scope

Target flow: `/import-audio` recognition lifecycle.

Key files:

- `/Users/studio/Documents/GitHub/voice2text/app/import-audio.tsx`
- `/Users/studio/Documents/GitHub/voice2text/features/session-editor/hooks/use-import-audio-session.ts`
- `/Users/studio/Documents/GitHub/voice2text/data/sqlite/repositories/recordings.repository.ts`

## Case 1: First Recognition Success

### Steps

1. Open import-audio page with a valid local audio file.
2. Switch to `语音识别` tab.
3. Click `离线识别`.
4. Wait until recognition finishes.

### Assertions

1. During recognition:
   - language picker is disabled
   - offline/online buttons are hidden
   - destructive button `停止识别` is visible
2. After recognition success:
   - transcript text area is visible with non-empty text
   - centered recognition module is hidden
   - top re-recognition entry (undo icon) is visible

## Case 2: Stop Recognition Rolls Back Snapshot

### Steps

1. Ensure transcript has initial text `A` (can be manually set before run).
2. Start offline recognition.
3. While state is `preparing` or `recognizing`, click `停止识别`.

### Assertions

1. Transcript returns to exact pre-run snapshot text `A`.
2. State text changes to `识别已终止`.
3. Recognition busy UI is cleared (picker enabled, stop button hidden).

## Case 3: Recognition Failure Rolls Back Snapshot

### Steps

1. Ensure transcript has initial text `B`.
2. Start recognition with an invalid/unreadable source (or mock transcribe failure).
3. Wait for failure toast.

### Assertions

1. Transcript returns to exact pre-run snapshot text `B`.
2. Status text is failure-related (`安装失败` or `识别失败`).
3. Busy state exits correctly (no stuck `停止识别` button).

## Case 4: Save Then Reopen Restores Recent Mode Default

### Steps

1. Open import-audio page and produce transcript.
2. Trigger re-recognition using mode `在线识别` or `离线识别` so in-memory recent mode changes.
3. Save session successfully.
4. Leave page and reopen the same recording from list (`source=list`).
5. Open re-recognition picker.

### Assertions

1. Picker default value equals last saved recognition mode.
2. Picker option description contains `最近一次使用：**...识别**`.
3. DB row fields are consistent with UI default:
   - `recent_recognition_mode`
   - `last_recognition_at_ms`

## Automation Skeleton (Framework-Agnostic)

Use this contract when wiring to Detox/Jest/Vitest later:

```ts
type RecognitionScenario = {
    id: 'success' | 'stop-rollback' | 'error-rollback' | 'reopen-restore-recent-mode';
    arrange: () => Promise<void>;
    act: () => Promise<void>;
    assert: () => Promise<void>;
};
```

Each scenario should assert both:

1. UI state correctness (`button visibility`, `picker disabled`, `transcript content`)
2. Persistence correctness (`recordings` row values)

