import type { ReplyToNudgeInput } from '@aido/api';

export interface NudgeEventMap {
  nudge_sent: undefined;
  nudge_replied: { reply_kind: ReplyToNudgeInput['replyKind'] };
  nudge_thanks_sent: { recipient_count: number };
  remind_nudge_sent: undefined;
}
