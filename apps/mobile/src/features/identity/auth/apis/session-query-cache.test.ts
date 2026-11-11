import '@src/shared/i18n/init';
import {
  createHapticsGatewayStub,
  createPendingResponse,
  createTestQueryClient,
  renderUiHook,
} from '@src/shared/__tests__';
import { ParseError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import { act, screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';

import { createSessionQueryCache } from './session-query-cache';

describe('createSessionQueryCache', () => {
  it('진행 중 mutation의 콜백을 비워 끝나도 캐시를 쓰지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const pending = createPendingResponse('저장됨');
    const onSuccess = jest.fn();
    const onSettled = jest.fn();
    const running = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => pending.response,
        onSuccess,
        onSettled,
      })
      .execute(undefined);
    await Promise.resolve();

    // When
    createSessionQueryCache(queryClient).abandonPendingMutations();
    pending.settle();
    await running;

    // Then
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('끝난 세션의 실패는 다음 화면에 햅틱·토스트로 알리지 않는다', async () => {
    // Given
    const haptics = createHapticsGatewayStub();
    const { queryClient } = await renderUiHook(() => null, { di: { haptics } });
    let fail: () => void = noop;
    const response = new Promise<string>((_resolve, reject) => {
      fail = () => reject(new ParseError());
    });
    const running = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => response,
        meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.addFailedRetry' } },
      })
      .execute(undefined);
    await Promise.resolve();

    // When
    createSessionQueryCache(queryClient).abandonPendingMutations();
    await act(async () => {
      fail();
      await running.catch(noop);
    });

    // Then
    expect(haptics.notify).not.toHaveBeenCalled();
    expect(screen.queryByText(i18n.t('todo:toast.addFailedRetry'))).toBeNull();
  });

  it('요청 자체는 끊지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const pending = createPendingResponse('저장됨');
    const running = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => pending.response })
      .execute(undefined);
    await Promise.resolve();

    // When
    createSessionQueryCache(queryClient).abandonPendingMutations();
    pending.settle();

    // Then
    await expect(running).resolves.toBe('저장됨');
  });

  it('조회 캐시만 비우면 mutation 기록은 남는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['user', 'me'], { id: 'a' });
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: async () => '저장됨' })
      .execute(undefined);

    // When
    createSessionQueryCache(queryClient).clearQueries();

    // Then
    expect(queryClient.getQueryData(['user', 'me'])).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1);
  });
});
