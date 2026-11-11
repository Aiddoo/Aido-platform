import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

import { createRuleTester } from '../rule-tester.mjs';
import rules from './observability.mjs';

const tester = createRuleTester();

const FROZEN = { frozenNames: ['ai_parse_used'] };

tester.run('analytics-event-catalog', rules['analytics-event-catalog'], {
  valid: [
    {
      code: "declare module '@src/shared/analytics/event-map' { interface AppEventMap { memo_share_tapped: { source: 'toolbar' }; offline_banner_shown: undefined } }",
      options: [FROZEN],
    },
    {
      code: 'interface AppEventMap { ai_parse_used: { todo_count: number } }',
      options: [FROZEN],
    },
    'interface OtherMap { todoCompleted: { field: string } }',
    'interface AppEventMap { push_permission_prompt_shown: { step: PushPermissionStep } }',
    'interface AppEventMap { push_permission_requested: { source: PushPermissionPromptSource } }',
    'interface AppEventMap { auth_email_verification_resent: undefined; auth_email_verified: undefined }',
    'interface AppEventMap { auth_password_reset_completed: undefined; auth_password_changed: undefined }',
    'interface AppEventMap { subscription_management_opened: undefined; support_inquiry_submitted: undefined }',
    'interface AppEventMap { marketing_push_opted_in: undefined; marketing_push_opted_out: undefined }',
  ],
  invalid: [
    { code: 'interface AppEventMap { ai_parse_used: undefined }', errors: 1 },
    { code: 'interface AppEventMap { memo_shared: undefined }', errors: 1 },
    { code: 'interface AppEventMap { opted_in: undefined }', errors: 1 },
    { code: 'interface AppEventMap { push_permission_result: undefined }', errors: 1 },
    { code: 'interface AppEventMap { MemoShareTapped: undefined }', errors: 1 },
    { code: 'interface AppEventMap { memo_share_tapped: { shareTarget: Target } }', errors: 1 },
    { code: 'interface AppEventMap { memo_share_tapped: { target: string } }', errors: 1 },
    { code: 'interface AppEventMap { memo_share_tapped: { target?: string | null } }', errors: 1 },
    {
      code: 'interface AppEventMap { ai_parse_used: { field: string } }',
      options: [FROZEN],
      errors: 1,
    },
  ],
});

const packageRoot = mkdtempSync(join(tmpdir(), 'aido-log-event-key-'));
after(() => rmSync(packageRoot, { recursive: true, force: true }));
writeFileSync(join(packageRoot, 'package.json'), '{}');
mkdirSync(join(packageRoot, 'src/memo'), { recursive: true });
mkdirSync(join(packageRoot, 'src/voice'), { recursive: true });
writeFileSync(
  join(packageRoot, 'src/memo/memo-log-events.ts'),
  "export const MEMO_LOG_EVENT = { SAVE_FAILED: 'memo.save.failed' } as const;\n",
);
const voiceFile = join(packageRoot, 'src/voice/voice-log-events.ts');

tester.run('log-event-key', rules['log-event-key'], {
  valid: [
    {
      code: "export const VOICE_LOG_EVENT = { START_FAILED: 'voice.recording.start-failed', STOPPED: 'voice.recording.stopped' } as const;",
      filename: voiceFile,
    },
  ],
  invalid: [
    {
      code: "export const VOICE_LOG_EVENT = { START_FAILED: 'voice.recordingStartFailed' } as const;",
      filename: voiceFile,
      errors: 1,
    },
    {
      code: "export const VOICE_LOG_EVENT = { A: 'voice.recording.failed', B: 'voice.recording.failed' } as const;",
      filename: voiceFile,
      errors: 1,
    },
    {
      code: "export const VOICE_LOG_EVENT = { SAVE_FAILED: 'memo.save.failed' } as const;",
      filename: voiceFile,
      errors: 1,
    },
  ],
});
