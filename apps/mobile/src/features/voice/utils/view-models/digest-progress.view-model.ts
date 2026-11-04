import { match } from 'ts-pattern';

export const DIGEST_STEPS = ['transcript', 'key-points', 'to-dos'] as const;
export type DigestStep = (typeof DIGEST_STEPS)[number];

export type DigestStepStatus = 'done' | 'doing';

/**
 * 정리를 기다리는 동안의 단계. 글자는 기기에서 이미 끝났고, 핵심과 할 일은 서버가 한 요청으로 함께 만들어
 * 어느 쪽이 끝났는지 알 수 없다. 모르는 진행을 지어내지 않고 둘 다 진행 중으로 둔다.
 */
export function getDigestStepStatus(step: DigestStep): DigestStepStatus {
  return match(step)
    .returnType<DigestStepStatus>()
    .with('transcript', () => 'done')
    .with('key-points', 'to-dos', () => 'doing')
    .exhaustive();
}
