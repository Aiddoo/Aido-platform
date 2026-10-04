import type { ReplyToNudgeInput } from '@aido/validators';

export interface FriendEventMap {
  friend_request_sent: undefined;
  friend_request_cancelled: undefined;
  friend_request_accepted: undefined;
  friend_request_rejected: undefined;
  friend_removed: undefined;
  friend_reordered: undefined;
  nudge_sent: undefined;
  nudge_replied: { reply_kind: ReplyToNudgeInput['replyKind'] };
  nudge_thanks_sent: { recipient_count: number };
  remind_nudge_sent: undefined;
}
