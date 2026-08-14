import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createNudgeApiError,
  createNudgeCooldownInfoDto,
  createNudgeLimitInfoDto,
  createSendNudgeResponseDto,
  INVALID_DTO,
} from '../__tests__/todo-nudge.factories';
import { isTodoNudgeError } from '../models/todo-nudge.error';
import { TodoNudgeService } from './todo-nudge.service';

describe('TodoNudgeService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: TodoNudgeService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new TodoNudgeService(httpClient);
  });

  // ── sendNudge ────────────────────────────────

  describe('sendNudge', () => {
    test('메시지 200자 초과 → TodoNudgeError.MESSAGE_TOO_LONG', async () => {
      // Given
      const longMessage = 'a'.repeat(201);

      // When
      const result = await service.sendNudge({
        receiverId: 'user-1',
        todoId: 1,
        message: longMessage,
      });

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(isTodoNudgeError(result.error)).toBe(true);
        expect(result.error.code).toBe('TODO_NUDGE_MESSAGE_TOO_LONG');
      }
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    test('정상 메시지 → SendTodoNudgeResult 반환', async () => {
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

    test('메시지 없음 → message undefined로 전달', async () => {
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

    test('일일 한도 → NUDGE_1101 에러', async () => {
      // Given
      const apiError = createNudgeApiError({ code: 'NUDGE_1101' });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.sendNudge({ receiverId: 'user-1', todoId: 1 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('쿨다운 → NUDGE_1103 에러', async () => {
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

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.sendNudge({ receiverId: 'user-1', todoId: 1 })).rejects.toThrow(
        'Invalid sendNudge response',
      );
    });
  });

  // ── getLimitInfo ─────────────────────────────

  describe('getLimitInfo', () => {
    test('정상 응답 → NudgeLimitInfo 반환', async () => {
      // Given
      const dto = createNudgeLimitInfoDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getLimitInfo();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/nudges/limit');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dailyLimit).toBe(5);
        expect(result.value.remainingToday).toBe(3);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createNudgeApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getLimitInfo();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── getCooldownInfoForUser ───────────────────

  describe('getCooldownInfoForUser', () => {
    test('정상 응답 → NudgeCooldownInfo 반환', async () => {
      // Given
      const dto = createNudgeCooldownInfoDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getCooldownInfoForUser('user-1');

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/nudges/cooldown/user-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.canNudge).toBe(true);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createNudgeApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getCooldownInfoForUser('user-1');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
