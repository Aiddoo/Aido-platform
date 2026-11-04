export const NUDGE_LIMITS = {
  COOLDOWN_HOURS: 24,
  MAX_MESSAGE_LENGTH: 200,
} as const;

export const REMIND_NUDGE_LIMITS = {
  COOLDOWN_HOURS: 1,
  MAX_MESSAGE_LENGTH: 200,
} as const;

export const NUDGE_REPLY_KINDS = ["STARTING", "THANKFUL", "LATER"] as const;

export type NudgeReplyKind = (typeof NUDGE_REPLY_KINDS)[number];
