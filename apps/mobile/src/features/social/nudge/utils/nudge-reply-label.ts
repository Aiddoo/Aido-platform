import type { NudgeReplyKind } from '@aido/api/vocabulary';
import { match } from 'ts-pattern';

export function getNudgeReplyLabelKey(kind: NudgeReplyKind) {
  return match(kind)
    .with('STARTING', () => 'interaction.starting' as const)
    .with('THANKFUL', () => 'interaction.thankful' as const)
    .with('LATER', () => 'interaction.later' as const)
    .exhaustive();
}
