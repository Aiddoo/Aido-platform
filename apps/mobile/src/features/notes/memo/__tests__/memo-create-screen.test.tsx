import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { NetworkError, TimeoutError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  createTestQueryClient,
  createApiError,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useNavigation } from 'expo-router';

import MemoCreateRoute from '../../../../../app/(app)/memo/create';
import { MEMO_QUERY_KEYS } from '../queries/memo-query-keys';
import { createMemoDraftKey } from '../utils/memo-draft';
import { createMemo, createMemoMutationResponseDto } from './memo.fixtures';

const ACCOUNT_ID = 'account-1';
const DRAFT_KEY = createMemoDraftKey({ userId: ACCOUNT_ID });

function createMemoScreenDi() {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  const di = createTestDi({ ports: { httpClient, analytics, haptics, queryClient } });

  return { di, httpClient, analytics, haptics };
}

async function renderMemoCreate(
  { di }: ReturnType<typeof createMemoScreenDi> = createMemoScreenDi(),
) {
  await renderScreen(<MemoCreateRoute />, { di, withLocalDate: true });
}

async function typeContent(content: string) {
  const input = await screen.findByPlaceholderText('아이디어를 자유롭게 적어보세요');
  await act(async () => {
    await fireEvent.changeText(input, content);
  });
}

async function pressToolbar(label: '저장' | '뒤로 가기') {
  await act(async () => {
    await fireEvent.press(await screen.findByLabelText(label));
  });
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length;
}

describe('메모 만들기 화면', () => {
  it('저장 버튼을 빠르게 두 번 눌러도 메모는 한 번만 만든다', async () => {
    // Given
    const setup = createMemoScreenDi();
    setup.httpClient.post.mockResolvedValue(ok(createMemoMutationResponseDto()));
    await renderMemoCreate(setup);
    await typeContent('새 메모');
    const save = await screen.findByLabelText('저장');

    // When
    await act(async () => {
      await fireEvent.press(save);
      await fireEvent.press(save);
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('저장하면 앞뒤 공백을 뺀 글을 보내고 초안을 지우고 목록을 다시 받게 한 뒤 돌아간다', async () => {
    // Given
    const setup = createMemoScreenDi();
    setup.httpClient.post.mockResolvedValue(ok(createMemoMutationResponseDto()));
    setup.di.queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
      pages: [{ items: [createMemo()], nextCursor: null }],
      pageParams: [undefined],
    });
    setup.di.draftService.save(DRAFT_KEY, { content: '  새 메모\n' });
    await renderMemoCreate(setup);

    // When
    await pressToolbar('저장');

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(setup.httpClient.post).toHaveBeenCalledWith(
      'v1/memos',
      { content: '새 메모' },
      { headers: { 'Idempotency-Key': expect.any(String) } },
    );
    expect(setup.di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
    expect(setup.di.queryClient.getQueryState(MEMO_QUERY_KEYS.list())?.isInvalidated).toBe(true);
    expect(countEvents(setup.analytics, 'memo_created')).toBe(1);
  });

  it('저장하지 않고 떠난 초안이 있으면 그 글로 이어 쓴다', async () => {
    // Given
    const setup = createMemoScreenDi();
    setup.di.draftService.save(DRAFT_KEY, { content: '쓰다 만 메모' });

    // When
    await renderMemoCreate(setup);

    // Then
    expect(await screen.findByDisplayValue('쓰다 만 메모')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText('저장')).toBeEnabled());
  });

  it('공백만 쓴 메모는 저장 버튼을 켜지 않고 보내지 않는다', async () => {
    // Given
    const setup = createMemoScreenDi();
    await renderMemoCreate(setup);

    // When
    await typeContent('   \n ');
    await pressToolbar('저장');

    // Then
    expect(screen.getByLabelText('저장')).toBeDisabled();
    expect(setup.httpClient.post).not.toHaveBeenCalled();
  });

  it.each([
    {
      reason: '연결이 끊겨',
      respond: (httpClient: ReturnType<typeof createHttpClientStub>) =>
        httpClient.post.mockRejectedValue(new NetworkError()),
    },
    {
      reason: '서버가 거절해',
      respond: (httpClient: ReturnType<typeof createHttpClientStub>) =>
        httpClient.post.mockResolvedValue(
          fail(createApiError('SYS_0001', { message: '요청이 잘못됐어요', status: 400 })),
        ),
    },
  ])('$reason 저장하지 못하면 한 번 알리고 글을 둔 채 화면에 머문다', async ({ respond }) => {
    // Given
    const setup = createMemoScreenDi();
    respond(setup.httpClient);
    await renderMemoCreate(setup);
    await typeContent('새 메모');

    // When
    await pressToolbar('저장');

    // Then
    await waitFor(() => expect(setup.haptics.notify).toHaveBeenCalledWith('error'));
    expect(setup.haptics.notify).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('새 메모')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(countEvents(setup.analytics, 'memo_created')).toBe(0);
  });

  it('글자 수 한도를 넘기면 저장 버튼을 끄고 보내지 않는다', async () => {
    // Given
    const setup = createMemoScreenDi();
    await renderMemoCreate(setup);

    // When
    await typeContent('가'.repeat(5_001));
    await pressToolbar('저장');

    // Then
    expect(screen.getByLabelText('저장')).toBeDisabled();
    expect(setup.httpClient.post).not.toHaveBeenCalled();
  });

  it('빈 화면에서 뒤로 가면 아무것도 보내지 않고 돌아간다', async () => {
    // Given
    const setup = createMemoScreenDi();
    await renderMemoCreate(setup);

    // When
    await pressToolbar('뒤로 가기');

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(setup.httpClient.post).not.toHaveBeenCalled();
  });

  it('글을 쓰고 뒤로 가면 저장한 뒤 돌아간다', async () => {
    // Given
    const setup = createMemoScreenDi();
    setup.httpClient.post.mockResolvedValue(ok(createMemoMutationResponseDto()));
    await renderMemoCreate(setup);
    await typeContent('새 메모');

    // When
    await pressToolbar('뒤로 가기');

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('서버가 거절해 저장하지 못하면 뒤로 가기를 눌러도 글을 둔 채 화면에 머문다', async () => {
    // Given
    const setup = createMemoScreenDi();
    setup.httpClient.post.mockResolvedValue(
      fail(createApiError('SYS_0001', { message: '요청이 잘못됐어요', status: 400 })),
    );
    await renderMemoCreate(setup);
    await typeContent('새 메모');

    // When
    await pressToolbar('뒤로 가기');

    // Then
    await waitFor(() => expect(setup.haptics.notify).toHaveBeenCalledWith('error'));
    expect(screen.getByDisplayValue('새 메모')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });

  describe('초안 저장', () => {
    setupFakeTimersPerTest();

    it('연결이 끊겨 저장하지 못해도 뒤로 가기는 돌아가고 글은 초안에 남는다', async () => {
      // Given
      const setup = createMemoScreenDi();
      setup.httpClient.post.mockRejectedValue(new NetworkError());
      await renderMemoCreate(setup);
      await typeContent('새 메모');
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // When
      await pressToolbar('뒤로 가기');
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(setup.di.draftService.restore(DRAFT_KEY)).toMatchObject({
        status: 'restored',
        value: { content: '새 메모' },
      });
    });

    it('저장에 실패해도 적던 글은 초안에 남는다', async () => {
      // Given
      const setup = createMemoScreenDi();
      setup.httpClient.post.mockRejectedValue(new NetworkError());
      await renderMemoCreate(setup);
      await typeContent('새 메모');

      // When
      await pressToolbar('저장');
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(setup.di.draftService.restore(DRAFT_KEY)).toMatchObject({
        status: 'restored',
        value: { content: '새 메모' },
      });
    });
  });

  describe('저장 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('저장해 화면이 내려가는 동안 저장을 다시 눌러도 메모는 하나만 만든다', async () => {
      // Given
      const setup = createMemoScreenDi();
      setup.httpClient.post.mockResolvedValue(ok(createMemoMutationResponseDto()));
      await renderMemoCreate(setup);
      await typeContent('새 메모');
      await pressToolbar('저장');
      // 연타 가드(600ms)가 지난 뒤다. 성공하면 요청 키를 지워 같은 글도 새 키로 간다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(router.back).toHaveBeenCalledTimes(1);

      // When
      await pressToolbar('저장');
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
    });

    it('저장하는 동안에는 저장과 뒤로 가기를 다시 누를 수 없다', async () => {
      // Given
      const setup = createMemoScreenDi();
      const pending = createPendingResponse(ok(createMemoMutationResponseDto()));
      setup.httpClient.post.mockReturnValue(pending.response);
      await renderMemoCreate(setup);
      await typeContent('새 메모');

      // When
      await pressToolbar('저장');

      // Then
      expect(screen.getByLabelText('저장')).toBeDisabled();
      expect(screen.getByLabelText('뒤로 가기')).toBeDisabled();
      pending.settle();
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(router.back).toHaveBeenCalledTimes(1);
    });
  });

  describe('저장을 기다리는 사이 떠남', () => {
    it.each([{ button: '저장' as const }, { button: '뒤로 가기' as const }])(
      '$button 버튼으로 저장하는 사이 밀어서 떠났으면 저장이 끝나도 이전 화면을 한 번 더 닫지 않는다',
      async ({ button }) => {
        // Given
        const navigation = {
          isFocused: jest.fn(() => true),
          getParent: () => undefined,
          addListener: () => () => undefined,
        };
        jest.mocked(useNavigation).mockReturnValue(navigation);
        const setup = createMemoScreenDi();
        const pending = createPendingResponse(ok(createMemoMutationResponseDto()));
        setup.httpClient.post.mockReturnValue(pending.response);
        await renderMemoCreate(setup);
        await typeContent('새 메모');
        await pressToolbar(button);
        navigation.isFocused.mockReturnValue(false);

        // When
        await act(async () => {
          pending.settle();
        });

        // Then
        await waitFor(() =>
          expect(setup.di.draftService.restore(DRAFT_KEY).status).not.toBe('restored'),
        );
        expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
        expect(router.back).not.toHaveBeenCalled();
      },
    );
  });

  describe('다시 그리기', () => {
    // 화면 맨 위(폼을 가진 컴포넌트)만 화면 객체를 읽어, 그 호출 수가 맨 위가 그려진 횟수다
    function countScreenRenders() {
      return jest.mocked(useNavigation).mock.calls.length;
    }

    it('글자를 칠 때 화면 맨 위는 다시 그려지지 않고 입력칸만 바뀐다', async () => {
      // Given
      await renderMemoCreate();
      // 처음 친 글자는 저장 버튼을 켠다. 그 뒤부터 센다
      await typeContent('새');
      const renderCountBeforeTyping = countScreenRenders();
      const input = screen.getByPlaceholderText('아이디어를 자유롭게 적어보세요');

      // When
      await fireEvent.changeText(input, '새 메');
      await fireEvent.changeText(input, '새 메모');
      await fireEvent.changeText(input, '새 메모 하나');

      // Then
      expect(input).toHaveDisplayValue('새 메모 하나');
      expect(countScreenRenders()).toBe(renderCountBeforeTyping);
    });
  });

  describe('시간 초과 뒤 다시 저장', () => {
    setupFakeTimersPerTest();

    async function saveAfterTimeout(httpClient: ReturnType<typeof createHttpClientStub>) {
      httpClient.post
        .mockRejectedValueOnce(new TimeoutError())
        .mockResolvedValueOnce(ok(createMemoMutationResponseDto()));
      await typeContent('새 메모');
      await pressToolbar('저장');
      await screen.findAllByText('응답이 늦어지고 있어요. 잠시 뒤 다시 시도해주세요');
      // 연타 가드(600ms)가 지난 뒤의 두 번째 저장이다
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }

    it('같은 글을 다시 저장하면 같은 키를 보내 서버가 메모를 하나만 만든다', async () => {
      // Given
      const setup = createMemoScreenDi();
      await renderMemoCreate(setup);
      await saveAfterTimeout(setup.httpClient);

      // When
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      const [first, retried] = setup.httpClient.post.mock.calls;
      expect(first?.[2]).toEqual({ headers: { 'Idempotency-Key': expect.any(String) } });
      expect(retried?.[2]).toEqual(first?.[2]);
    });

    it('글을 고쳐 저장하면 새 키를 보내 고친 글이 새 메모로 남는다', async () => {
      // Given
      const setup = createMemoScreenDi();
      await renderMemoCreate(setup);
      await saveAfterTimeout(setup.httpClient);

      // When
      await typeContent('새 메모 고침');
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      const [first, edited] = setup.httpClient.post.mock.calls;
      expect(edited?.[2]).not.toEqual(first?.[2]);
    });
  });
});
