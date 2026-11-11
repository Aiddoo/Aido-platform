import { createHttpClientStub, createLoggerStub } from '@src/testing/core';

import { VoiceService } from './voice.service';

const quickPlanDto = {
  plan: { actions: [], omittedTodoCount: 0 },
  featureQuota: null,
  charged: false,
};

describe('VoiceService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let logger: ReturnType<typeof createLoggerStub>;
  let service: VoiceService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    logger = createLoggerStub();
    service = new VoiceService(httpClient, logger);
  });

  it('빠른 계획은 Idempotency-Key 헤더와 함께 보내고 한도가 없어도 결과를 돌려준다', async () => {
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
    expect(result).toMatchObject({ ok: true, value: { featureQuota: null, isCharged: false } });
  });

  it('응답이 계약과 다르면 내용 없이 매핑 실패를 남기고 ParseError를 던진다', async () => {
    // Given
    httpClient.post.mockResolvedValue({ ok: true, value: { plan: 1 } });

    // When
    const result = service.createQuickPlan({ text: '장보기', source: 'text' }, 'key-1');

    // Then
    await expect(result).rejects.toThrow('Invalid createQuickPlan response');
    expect(logger.error).toHaveBeenCalledWith(
      'voice.plan.mapping-failed',
      undefined,
      expect.any(Object),
    );
  });
});
