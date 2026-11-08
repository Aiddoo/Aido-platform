import type { NudgeReplyKind } from '@aido/api/vocabulary';

export const NUDGE_REPLY_LABEL_KEYS = {
  STARTING: 'interaction.starting',
  THANKFUL: 'interaction.thankful',
  LATER: 'interaction.later',
} as const satisfies Record<NudgeReplyKind, string>;
