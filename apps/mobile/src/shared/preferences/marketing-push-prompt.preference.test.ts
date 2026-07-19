import { createMockSyncStorage } from '@src/shared/__tests__';
import {
  readMarketingPushPromptState,
  recordMarketingPushPrompt,
} from './marketing-push-prompt.preference';

describe('readMarketingPushPromptState', () => {
  it('저장된 값이 없으면 빈 상태(count 0, lastPromptedAt null)를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    const result = readMarketingPushPromptState(storage);

    // Then
    expect(result).toEqual({ lastPromptedAt: null, count: 0 });
  });

  it('저장된 유효한 JSON을 그대로 복원한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(
      JSON.stringify({ lastPromptedAt: '2026-07-19T00:00:00.000Z', count: 2 }),
    );

    // When
    const result = readMarketingPushPromptState(storage);

    // Then
    expect(result).toEqual({ lastPromptedAt: '2026-07-19T00:00:00.000Z', count: 2 });
  });

  it('손상된 값이면 빈 상태로 폴백한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('{not-json');

    // When
    const result = readMarketingPushPromptState(storage);

    // Then
    expect(result).toEqual({ lastPromptedAt: null, count: 0 });
  });
});

describe('recordMarketingPushPrompt', () => {
  it('노출 시각을 ISO로 저장하고 count를 1 증가시킨다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(
      JSON.stringify({ lastPromptedAt: '2026-07-01T00:00:00.000Z', count: 1 }),
    );

    // When
    recordMarketingPushPrompt(storage, new Date('2026-07-20T09:00:00.000Z'));

    // Then
    expect(storage.set).toHaveBeenCalledWith(
      'aido_marketing_push_prompt',
      JSON.stringify({ lastPromptedAt: '2026-07-20T09:00:00.000Z', count: 2 }),
    );
  });

  it('기존 값이 없으면 count 1로 시작한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    recordMarketingPushPrompt(storage, new Date('2026-07-20T09:00:00.000Z'));

    // Then
    expect(storage.set).toHaveBeenCalledWith(
      'aido_marketing_push_prompt',
      JSON.stringify({ lastPromptedAt: '2026-07-20T09:00:00.000Z', count: 1 }),
    );
  });
});
