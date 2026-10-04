import { createMockHttpClient } from '@src/shared/__tests__';
import { ApiError, ParseError, unwrap } from '@src/shared/errors';

import { createNudgeInteractionDto } from '../__tests__/nudge-interaction.factories';
import { TodoNudgeService } from './todo-nudge.service';

describe('TodoNudgeService의 콕 주고받기 계약', () => {
  const setup = () => {
    const httpClient = createMockHttpClient();
    return { httpClient, service: new TodoNudgeService(httpClient) };
  };

  test('보낸 콕 목록의 방향과 커서, 취소 신호를 그대로 전송한다', async () => {
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
    expect(page).toMatchObject({ nextCursor: 1, hasNext: true });
    expect(page.items[0]?.createdAt).toBeInstanceOf(Date);
  });

  test('답장 요청에는 완료 상태를 넣지 않고 최신 답장 모델을 반환한다', async () => {
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

  test('감사 미리보기의 마지막 콕 ID만 서버에 보내고 전송 수를 반환한다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.put.mockResolvedValue({ ok: true, value: { sentCount: 2 } });
    // When
    const sentCount = unwrap(await service.sendThanks(1, { throughNudgeId: 10 }));
    // Then
    expect(httpClient.put).toHaveBeenCalledWith('v1/nudges/todos/1/thanks', { throughNudgeId: 10 });
    expect(sentCount).toBe(2);
  });

  test('현재 권한이 사라진 서버 오류는 번역하거나 다른 오류로 바꾸지 않는다', async () => {
    // Given
    const { httpClient, service } = setup();
    const error = new ApiError('NUDGE_1109', '사용할 수 없는 콕이에요', 409);
    httpClient.put.mockResolvedValue({ ok: false, error });
    // When
    const result = await service.replyToNudge(1, { replyKind: 'STARTING' });
    // Then
    expect(result).toEqual({ ok: false, error });
  });

  test('필수 친구 정보가 없는 응답은 ParseError로 경계에 전달한다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.get.mockResolvedValue({ ok: true, value: { id: 1 } });
    // When
    const request = service.getInteraction(1);
    // Then
    await expect(request).rejects.toBeInstanceOf(ParseError);
  });

  test('기능이 준비되지 않았으면 진입점을 비활성화한다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.get.mockResolvedValue({ ok: true, value: { enabled: false } });
    // When
    const isAvailable = unwrap(await service.getInteractionAvailability());
    // Then
    expect(isAvailable).toBe(false);
  });
});
