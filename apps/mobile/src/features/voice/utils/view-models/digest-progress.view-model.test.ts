import { getDigestStepStatus } from './digest-progress.view-model';

describe('getDigestStepStatus', () => {
  test('지금 단계는 진행 중, 앞 단계는 끝남, 뒤 단계는 기다림이다', () => {
    // Given
    const progress = 'key-points';

    // When
    const statuses = (['transcript', 'key-points', 'to-dos'] as const).map((step) =>
      getDigestStepStatus(progress, step),
    );

    // Then
    expect(statuses).toEqual(['done', 'doing', 'waiting']);
  });

  test('모두 끝나면 세 단계가 모두 끝남이다', () => {
    // Given
    const progress = 'done';

    // When
    const statuses = (['transcript', 'key-points', 'to-dos'] as const).map((step) =>
      getDigestStepStatus(progress, step),
    );

    // Then
    expect(statuses).toEqual(['done', 'done', 'done']);
  });
});
