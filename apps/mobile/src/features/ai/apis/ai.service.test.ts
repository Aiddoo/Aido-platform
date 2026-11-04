import { ErrorCode } from '@aido/api/errors';
import type { Logger } from '@src/core/ports/logger';
import { createMockHttpClient } from '@src/shared/__tests__';
import { ApiError } from '@src/shared/errors/api-error';

import { createParseTodoResponseDto } from '../__tests__/parsed-todo.factories';
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

  describe('parseTodo', () => {
    test('정상 응답 → ParsedTodoResult 반환', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: createParseTodoResponseDto() });

      // When
      const result = await service.parseTodo('내일 오전 9시 회의');

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/ai/parse-todo', {
        text: '내일 오전 9시 회의',
      });
      expect(result.ok && result.value.data.startDate).toBeInstanceOf(Date);
    });

    test('AI 할 일 만들기 한도 초과 → Result.err 반환', async () => {
      // Given
      const apiError = new ApiError(ErrorCode.AI_1303, '이번 달 AI 할 일 만들기를 다 썼어요', 429);
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.parseTodo('테스트');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.parseTodo('테스트')).rejects.toThrow('Invalid parseTodo response');
    });
  });
});
