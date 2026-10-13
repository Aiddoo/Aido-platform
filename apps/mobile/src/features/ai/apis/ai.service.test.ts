import type { Logger } from '@src/core/ports/logger';
import { createMockHttpClient } from '@src/shared/__tests__';

import { createAiApiError, createAiUsageResponseDto } from '../__tests__/ai-usage.factories';
import { AiService } from './ai.service';

const createLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('AiService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: AiService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new AiService(httpClient, createLogger());
  });

  describe('getAiUsage', () => {
    test('정상 응답 → AiUsage 반환', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: createAiUsageResponseDto() });

      // When
      const result = await service.getAiUsage();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/ai/usage', { signal: undefined });
      expect(result).toEqual({
        ok: true,
        value: { used: 3, limit: 10, resetsAt: new Date('2026-03-09T00:00:00.000Z') },
      });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAiApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getAiUsage();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
