import type { NudgeReplyKind } from '@aido/api';
import { match } from 'ts-pattern';

export const getNudgeReplyLabelKey = (kind: NudgeReplyKind) =>
  match(kind)
    .with('STARTING', () => 'interaction.starting' as const)
    .with('THANKFUL', () => 'interaction.thankful' as const)
    .with('LATER', () => 'interaction.later' as const)
    .exhaustive();
