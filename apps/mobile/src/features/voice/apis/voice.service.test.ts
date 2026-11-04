import { createMockHttpClient } from '@src/shared/__tests__';

import { VoiceService } from './voice.service';

const quickPlanDto = {
  plan: { actions: [], omittedTodoCount: 0 },
  meta: {
    model: 'm',
    processingTimeMs: 1,
    tokenUsage: { input: 1, output: 1 },
    promptVersion: 'quick-plan@1',
  },
  featureQuota: null,
  charged: false,
};

describe('VoiceService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let logger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let service: VoiceService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service = new VoiceService(httpClient, logger);
  });

  test('빠른 계획은 Idempotency-Key 헤더와 함께 보내고 한도가 없어도 결과를 돌려준다', async () => {
    // Given
    httpClient.post.mockResolvedValue({ ok: true, value: quickPlanDto });

    // When
    const result = await service.createQuickPlan({ text: '장보기', source: 'voice' }, 'key-1');

    // Then
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/quick-plans',
      { text: '장보기', source: 'VOICE' },
      expect.objectContaining({ headers: { 'Idempotency-Key': 'key-1' } }),
    );
    expect(result).toMatchObject({ ok: true, value: { featureQuota: null, charged: false } });
  });

  test('응답이 계약과 다르면 내용 없이 매핑 실패를 남기고 ParseError를 던진다', async () => {
    // Given
    httpClient.post.mockResolvedValue({ ok: true, value: { plan: 1 } });

    // When & Then
    await expect(
      service.createQuickPlan({ text: '장보기', source: 'text' }, 'key-1'),
    ).rejects.toThrow('Invalid createQuickPlan response');
    expect(logger.error).toHaveBeenCalledWith(
      'voice.plan.mapping-failed',
      undefined,
      expect.any(Object),
    );
  });
});
