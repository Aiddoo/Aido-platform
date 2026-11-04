import { match } from 'ts-pattern';

export const DIGEST_STEPS = ['transcript', 'key-points', 'to-dos'] as const;
export type DigestStep = (typeof DIGEST_STEPS)[number];

/** 단계는 순서대로 하나씩 진행하고, 모두 끝나면 `done`이다 */
export type DigestProgress = DigestStep | 'done';

export type DigestStepStatus = 'done' | 'doing' | 'waiting';

export function getDigestStepStatus(progress: DigestProgress, step: DigestStep): DigestStepStatus {
  const currentIndex = match(progress)
    .with('done', () => DIGEST_STEPS.length)
    .otherwise((current) => DIGEST_STEPS.indexOf(current));
  const stepIndex = DIGEST_STEPS.indexOf(step);

  if (stepIndex < currentIndex) {
    return 'done';
  }
  return stepIndex === currentIndex ? 'doing' : 'waiting';
}
