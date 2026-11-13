import { ApiError, ParseError, unwrap } from '@src/shared/errors';
import { createHttpClientStub } from '@src/testing/core';

import { createNudgeInteractionDto } from '../__tests__/nudge-interaction.fixtures';
import {
  createNudgeLimitInfoDto,
  createSendNudgeResponseDto,
} from '../__tests__/todo-nudge.fixtures';
import { TodoNudgeApi } from './todo-nudge.api';

describe('TodoNudgeApi', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: TodoNudgeApi;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    service = new TodoNudgeApi(httpClient);
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
  });
});

describe('TodoNudgeApi의 콕 주고받기 계약', () => {
  const setup = () => {
    const httpClient = createHttpClientStub();
    return { httpClient, service: new TodoNudgeApi(httpClient) };
  };

  it('보낸 콕 목록의 방향과 커서, 취소 신호를 그대로 전송한다', async () => {
    // Given
    const { httpClient, service } = setup();
    const signal = new AbortController().signal;
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        items: [createNudgeInteractionDto()],
        pagination: { nextCursor: 1, hasNext: true, size: 20 },
      },
    });
    // When
    const page = unwrap(
      await service.getInteractions({ direction: 'sent', cursor: 10, limit: 20 }, signal),
    );
    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v1/nudges/interactions', {
      params: { direction: 'sent', cursor: 10, limit: 20 },
      signal,
    });
    expect(page).toMatchObject({ nextCursor: 1 });
    expect(page.items[0]?.createdAt).toBe('2026-03-08T10:00:00.000Z');
  });

  it('답장 요청에는 완료 상태를 넣지 않고 최신 답장 모델을 반환한다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.put.mockResolvedValue({
      ok: true,
      value: createNudgeInteractionDto({ replyKind: 'LATER' }),
    });
    // When
    const nudge = unwrap(await service.replyToNudge(1, { replyKind: 'LATER' }));
    // Then
    expect(httpClient.put).toHaveBeenCalledWith('v1/nudges/1/reply', { replyKind: 'LATER' });
    expect(nudge.replyKind).toBe('LATER');
    expect(nudge.isTodoCompleted).toBe(false);
  });

  it('감사 미리보기의 마지막 콕 ID만 서버에 보내고 전송 수를 반환한다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.put.mockResolvedValue({ ok: true, value: { sentCount: 2 } });
    // When
    const sentCount = unwrap(await service.sendThanks(1, { throughNudgeId: 10 }));
    // Then
    expect(httpClient.put).toHaveBeenCalledWith('v1/nudges/todos/1/thanks', { throughNudgeId: 10 });
    expect(sentCount).toBe(2);
  });

  it('감사 페이지 요청은 최초 기준 ID와 커서, 취소 신호를 전송한다', async () => {
    // Given
    const { httpClient, service } = setup();
    const signal = new AbortController().signal;
    const query = { limit: 20, cursor: 80, throughNudgeId: 100 };
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        todoId: 1,
        throughNudgeId: 100,
        recipients: [],
        totalRecipients: 40,
        nextCursor: null,
        hasNext: false,
        thankedRecipientCount: 0,
        lastThankedAt: null,
      },
    });
    // When
    const preview = unwrap(await service.getThanksPreview(1, query, signal));
    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v1/nudges/todos/1/thanks', {
      params: query,
      signal,
    });
    expect(preview.throughNudgeId).toBe(100);
    expect(preview.totalRecipients).toBe(40);
  });

  it('현재 권한이 사라진 서버 오류는 번역하거나 다른 오류로 바꾸지 않는다', async () => {
    // Given
    const { httpClient, service } = setup();
    const error = new ApiError('NUDGE_1109', '사용할 수 없는 콕이에요', 409);
    httpClient.put.mockResolvedValue({ ok: false, error });
    // When
    const result = await service.replyToNudge(1, { replyKind: 'STARTING' });
    // Then
    expect(result).toEqual({ ok: false, error });
  });

  it('필수 친구 정보가 없는 응답은 ParseError로 경계에 전달한다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.get.mockResolvedValue({ ok: true, value: { id: 1 } });
    // When
    const request = service.getInteraction(1);
    // Then
    await expect(request).rejects.toBeInstanceOf(ParseError);
  });

  it('기능이 준비되지 않았으면 진입점을 비활성화한다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.get.mockResolvedValue({ ok: true, value: { enabled: false } });
    // When
    const isAvailable = unwrap(await service.getInteractionAvailability());
    // Then
    expect(isAvailable).toBe(false);
  });
});
