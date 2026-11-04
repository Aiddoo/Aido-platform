import { DIGEST_STEPS, getDigestStepStatus } from './digest-progress.view-model';

describe('getDigestStepStatus', () => {
  test('글자는 끝났고 서버가 함께 만드는 핵심과 할 일은 진행 중이다', () => {
    // When
    const statuses = DIGEST_STEPS.map(getDigestStepStatus);

    // Then
    expect(statuses).toEqual(['done', 'doing', 'doing']);
  });
});
