import { createHttpClientStub } from '@src/testing/core';

import {
  createNudgeApiError,
  createNudgeLimitInfoDto,
  createSendNudgeResponseDto,
  INVALID_DTO,
} from '../__tests__/todo-nudge.fixtures';
import { TodoNudgeService } from './todo-nudge.service';

describe('TodoNudgeService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: TodoNudgeService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    service = new TodoNudgeService(httpClient);
  });

  describe('sendNudge', () => {
    it('메시지가 200자를 넘으면 MESSAGE_TOO_LONG 오류를 반환한다', async () => {
      // Given
      const longMessage = 'a'.repeat(201);

      // When
      const result = await service.sendNudge({
        receiverId: 'user-1',
        todoId: 1,
        message: longMessage,
      });

      // Then
      expect(result).toMatchObject({ ok: false, error: { code: 'TODO_NUDGE_MESSAGE_TOO_LONG' } });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('메시지를 보내면 콕 결과를 반환한다', async () => {
      // Given
      const dto = createSendNudgeResponseDto();
      httpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.sendNudge({
        receiverId: 'user-1',
        todoId: 1,
        message: '힘내!',
      });

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/nudges', {
        receiverId: 'user-1',
        todoId: 1,
        message: '힘내!',
      });
      expect(result).toEqual({ ok: true, value: { message: '콕 찔렀어요!' } });
    });

    it('메시지가 없으면 message 없이 요청한다', async () => {
      // Given
      const dto = createSendNudgeResponseDto();
      httpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      await service.sendNudge({ receiverId: 'user-1', todoId: 1 });

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/nudges', {
        receiverId: 'user-1',
        todoId: 1,
        message: undefined,
      });
    });

    it('하루 한도를 넘으면 NUDGE_1101 오류를 반환한다', async () => {
      // Given
      const apiError = createNudgeApiError({ code: 'NUDGE_1101' });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.sendNudge({ receiverId: 'user-1', todoId: 1 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('쿨다운 중이면 NUDGE_1103 오류를 반환한다', async () => {
      // Given
      const apiError = createNudgeApiError({
        code: 'NUDGE_1103',
        message: '아직 쿨다운 중이에요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.sendNudge({ receiverId: 'user-1', todoId: 1 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('응답이 계약과 다르면 ParseError를 던진다', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When

      const result = service.sendNudge({ receiverId: 'user-1', todoId: 1 });

      // Then

      await expect(result).rejects.toThrow('Invalid sendNudge response');
    });
  });

  describe('getLimitInfo', () => {
    it('응답을 받으면 콕 한도 정보를 반환한다', async () => {
      // Given
      const dto = createNudgeLimitInfoDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getLimitInfo();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/nudges/limit', { signal: undefined });
      expect(result).toMatchObject({ ok: true, value: { dailyLimit: 5, remainingToday: 3 } });
    });

    it('HTTP 오류이면 실패 결과를 반환한다', async () => {
      // Given
      const apiError = createNudgeApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getLimitInfo();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
