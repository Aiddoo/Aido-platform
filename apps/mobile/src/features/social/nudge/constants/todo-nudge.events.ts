import type { NudgeReplyKind } from '@aido/api/vocabulary';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    nudge_sent: undefined;
    nudge_replied: { reply_kind: NudgeReplyKind };
    nudge_thanks_sent: { recipient_count: number };
    remind_nudge_sent: undefined;
  }
}
