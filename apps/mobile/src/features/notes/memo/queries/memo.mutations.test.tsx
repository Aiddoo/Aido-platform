import type { Memo as MemoDto } from '@aido/api';
import { IDEMPOTENCY_KEY_HEADER } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { toEpochMs } from '@src/shared/date/instant';
import { NetworkError } from '@src/shared/errors/infra-error';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreenHook } from '@src/testing/render';
import { onlineManager, type QueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { createParseMemoResponseDto } from '../__tests__/parsed-memo.fixtures';
import { toMemo } from '../apis/memo.mapper';
import type { Memo } from '../domains/memo.model';
import { createMemoDraftKey } from '../utils/memo-draft';
import { createMemoPlanDraftKey, createMemoPlanRequestDraftKey } from '../utils/memo-plan-draft';
import { MEMO_QUERY_KEYS } from './memo-query-keys';
import {
  useConvertMemoToTodosMutationOptions,
  useCreateMemoMutationOptions,
  useDeleteMemoMutationOptions,
  useParseMemoMutationOptions,
  useSetMemoPinnedMutationOptions,
  useUpdateMemoMutationOptions,
} from './memo.mutations';
import { useGetMemoQueryOptions } from './memo.queries';

const originalMemo: MemoDto = {
  id: 5,
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  content: '처음 작성한 메모',
  isPinned: false,
  sortOrder: 0,
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};
const updatedMemo: MemoDto = {
  ...originalMemo,
  content: '수정하고 저장한 메모',
  updatedAt: '2026-10-02T00:01:00.000Z',
};

async function updateMemo(client: QueryClient) {
  const httpClient = createHttpClientStub();
  httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: updatedMemo }));
  const { result, unmount } = await renderScreenHook(
    () => useMutation(useUpdateMemoMutationOptions({ memoId: 5 })),
    {
      di: createTestDi({
        ports: {
          httpClient,
          haptics: createHapticsGatewayStub(),
          analytics: createAnalyticsStub(),
          queryClient: client,
        },
      }),
    },
  );

  await act(async () => {
    await result.current.mutateAsync({ content: updatedMemo.content });
  });
  await unmount();
}

describe('useCreateMemoMutationOptions', () => {
  async function renderCreateMemo() {
    const client = createTestQueryClient();
    client.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
    const httpClient = createHttpClientStub();
    const { result: createMemo } = await renderScreenHook(
      () => useMutation(useCreateMemoMutationOptions()),
      { di: createTestDi({ ports: { httpClient, queryClient: client } }) },
    );
    const create = async (content: string, result: 'ok' | 'fail') => {
      if (result === 'ok') {
        httpClient.post.mockResolvedValueOnce(ok({ message: 'created', memo: originalMemo }));
      } else {
        httpClient.post.mockRejectedValueOnce(new NetworkError());
      }
      await act(async () => {
        await createMemo.current.mutateAsync({ content }).catch(() => undefined);
      });
    };
    const sentKeys = () =>
      httpClient.post.mock.calls.map(([, , config]) => config?.headers?.[IDEMPOTENCY_KEY_HEADER]);
    const switchAccount = (accountId: string) =>
      client.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: accountId }));
    return { create, sentKeys, switchAccount };
  }

  it.each([
    {
      scenario: '응답을 못 받고 같은 글을 다시 저장',
      first: 'fail',
      content: '장보기',
      account: 'account-1',
      isSameKey: true,
    },
    {
      scenario: '실패 뒤 글을 고쳐 저장',
      first: 'fail',
      content: '장보기 목록',
      account: 'account-1',
      isSameKey: false,
    },
    {
      scenario: '저장에 성공한 뒤 같은 글을 다시 저장',
      first: 'ok',
      content: '장보기',
      account: 'account-1',
      isSameKey: false,
    },
    {
      scenario: '다른 계정이 같은 글을 저장',
      first: 'fail',
      content: '장보기',
      account: 'account-2',
      isSameKey: false,
    },
  ] as const)(
    '$scenario하면 같은 멱등 키를 보내는지: $isSameKey',
    async ({ first, content, account, isSameKey }) => {
      // Given
      const { create, sentKeys, switchAccount } = await renderCreateMemo();
      await create('장보기', first);
      switchAccount(account);

      // When
      await create(content, 'ok');

      // Then
      const [firstKey, secondKey] = sentKeys();
      expect(firstKey).toEqual(expect.any(String));
      expect(secondKey === firstKey).toBe(isSameKey);
    },
  );
});

describe('useUpdateMemoMutationOptions', () => {
  describe('메모 수정 후 상세 cache', () => {
    let client: QueryClient;

    beforeEach(() => {
      client = createTestQueryClient();
      client.setQueryData(MEMO_QUERY_KEYS.detail({ memoId: 5 }), toMemo(originalMemo));
    });

    afterEach(async () => {
      await client.cancelQueries();
    });

    it('저장 완료 후 즉시 다시 열어도 검증된 수정 응답으로 폼을 초기화한다', async () => {
      // Given
      // 상세 cache에 옛 메모가 있다

      // When
      await updateMemo(client);

      // Then
      expect(client.getQueryData<Memo>(MEMO_QUERY_KEYS.detail({ memoId: 5 }))).toEqual(
        toMemo(updatedMemo),
      );
    });

    it('응답으로 쓴 상세와 목록은 다시 받지 않는다', async () => {
      // Given
      client.setQueryData(MEMO_QUERY_KEYS.list(), {
        pages: [{ items: [toMemo(originalMemo)], nextCursor: null }],
        pageParams: [undefined],
      });

      // When
      await updateMemo(client);

      // Then
      expect(client.getQueryState(MEMO_QUERY_KEYS.detail({ memoId: 5 }))?.isInvalidated).toBe(
        false,
      );
      expect(client.getQueryState(MEMO_QUERY_KEYS.list())?.isInvalidated).toBe(false);
      expect(client.getQueryData(MEMO_QUERY_KEYS.list())?.pages[0]?.items).toEqual([
        toMemo(updatedMemo),
      ]);
    });

    it('저장 이전에 시작한 상세 조회가 늦게 끝나도 수정 내용을 덮어쓰지 않는다', async () => {
      // Given
      const staleResponse = Promise.withResolvers<Memo>();
      const refresh = client
        .query({
          queryKey: MEMO_QUERY_KEYS.detail({ memoId: 5 }),
          queryFn: () => staleResponse.promise,
        })
        .catch(() => undefined);

      // When
      await updateMemo(client);
      staleResponse.resolve(toMemo(originalMemo));
      await refresh;

      // Then
      expect(client.getQueryData<Memo>(MEMO_QUERY_KEYS.detail({ memoId: 5 }))).toEqual(
        toMemo(updatedMemo),
      );
    });
  });
});

describe('useSetMemoPinnedMutationOptions', () => {
  describe('메모 수정과 고정이 겹칠 때', () => {
    it('서버 처리 순서와 다르게 응답이 와도 먼저 끝난 응답이 고정을 지우지 않고 마지막에 서버 값으로 맞춘다', async () => {
      // Given
      const client = createTestQueryClient();
      const serverMemo: MemoDto = {
        ...updatedMemo,
        isPinned: true,
        updatedAt: '2026-10-02T00:02:00.000Z',
      };
      const httpClient = createHttpClientStub();
      httpClient.get.mockImplementation(respondByPath({ 'v1/memos/5': ok({ memo: serverMemo }) }));
      const updateResponse = createPendingResponse(ok({ message: 'updated', memo: updatedMemo }));
      const pinResponse = createPendingResponse(ok({ message: 'updated', memo: serverMemo }));
      httpClient.patch.mockImplementation(async (url) =>
        url === 'v1/memos/5/pin' ? pinResponse.response : updateResponse.response,
      );
      const { result: writes } = await renderScreenHook(
        () => {
          useQuery(useGetMemoQueryOptions({ memoId: 5 }));
          return {
            update: useMutation(useUpdateMemoMutationOptions({ memoId: 5 })),
            pin: useMutation(useSetMemoPinnedMutationOptions({ memoId: 5 })),
          };
        },
        { di: createTestDi({ ports: { httpClient, queryClient: client } }), withLocalDate: true },
      );
      await act(async () => {
        await client.refetchQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId: 5 }) });
      });
      httpClient.get.mockClear();
      let updating: Promise<unknown> | undefined;
      let pinning: Promise<unknown> | undefined;
      await act(async () => {
        updating = writes.current.update.mutateAsync({ content: updatedMemo.content });
        pinning = writes.current.pin.mutateAsync({ isPinned: true });
      });

      // When
      pinResponse.settle();
      await act(async () => {
        await pinning;
      });
      updateResponse.settle();
      await act(async () => {
        await updating;
      });

      // Then
      expect(client.getQueryData<Memo>(MEMO_QUERY_KEYS.detail({ memoId: 5 }))).toEqual(
        toMemo(serverMemo),
      );
    });
  });

  describe('메모 고정', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('고정으로 수정 시각이 바뀌어도 쓰던 글자와 AI 요청 초안을 낡았다고 버리지 않는다', async () => {
      // Given
      const client = createTestQueryClient();
      client.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
      client.setQueryData(MEMO_QUERY_KEYS.detail({ memoId: 5 }), toMemo(originalMemo));
      const pinnedMemo: MemoDto = {
        ...originalMemo,
        isPinned: true,
        updatedAt: '2026-10-02T00:05:00.000Z',
      };
      const httpClient = createHttpClientStub();
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: pinnedMemo }));
      const {
        result: pin,
        di: { draftService },
      } = await renderScreenHook(
        () => useMutation(useSetMemoPinnedMutationOptions({ memoId: 5 })),
        {
          di: createTestDi({
            ports: {
              httpClient,
              haptics: createHapticsGatewayStub(),
              analytics: createAnalyticsStub(),
              queryClient: client,
            },
          }),
          withLocalDate: true,
        },
      );
      const inputKey = createMemoDraftKey({ userId: 'account-1', memoId: 5 });
      const requestKey = createMemoPlanRequestDraftKey({ userId: 'account-1', memoId: 5 });
      const beforeEpoch = toEpochMs(toMemo(originalMemo).updatedAt);
      draftService.save(inputKey, { content: '쓰던 글' }, { sourceUpdatedAt: beforeEpoch });
      draftService.save(
        requestKey,
        {
          fingerprint: 'f',
          idempotencyKey: 'key-1',
          input: { content: '처음 작성한 메모', categoryId: 1 },
        },
        { sourceUpdatedAt: beforeEpoch },
      );

      // When
      await act(async () => {
        await pin.current.mutateAsync({ isPinned: true });
      });

      // Then
      const afterEpoch = toEpochMs(toMemo(pinnedMemo).updatedAt);
      expect(draftService.restore(inputKey, { sourceUpdatedAt: afterEpoch }).status).toBe(
        'restored',
      );
      expect(draftService.restore(requestKey, { sourceUpdatedAt: afterEpoch }).status).toBe(
        'restored',
      );
    });

    it('오프라인이면 멈춰 기다리지 않고 바로 실패해 안내한다', async () => {
      // Given
      onlineManager.setOnline(false);
      const httpClient = createHttpClientStub();
      httpClient.patch.mockRejectedValue(new NetworkError());
      const { result: mutation } = await renderScreenHook(
        () => useMutation(useSetMemoPinnedMutationOptions({ memoId: 5 })),
        {
          di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
          withLocalDate: true,
        },
      );

      // When
      const result = mutation.current.mutateAsync({ isPinned: true });

      // Then
      await expect(result).rejects.toBeInstanceOf(NetworkError);
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useParseMemoMutationOptions', () => {
  describe('AI 정리 중 메모 고정', () => {
    it('정리하는 사이 고정해 수정 시각이 바뀌어도 결과를 낡았다고 버리지 않는다', async () => {
      // Given
      const client = createTestQueryClient();
      client.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
      client.setQueryData(MEMO_QUERY_KEYS.detail({ memoId: 5 }), toMemo(originalMemo));
      const httpClient = createHttpClientStub();
      // 정리 응답이 오기 전에 다른 화면에서 메모를 고정해 수정 시각이 바뀐다
      httpClient.post.mockImplementation(async () => {
        client.setQueryData(
          MEMO_QUERY_KEYS.detail({ memoId: 5 }),
          toMemo({ ...originalMemo, isPinned: true, updatedAt: '2026-10-02T00:05:00.000Z' }),
        );
        return ok(createParseMemoResponseDto());
      });
      const {
        result: parse,
        di: { draftService },
      } = await renderScreenHook(
        () => ({
          mutation: useMutation(useParseMemoMutationOptions({ memoId: 5 })),
          timeZone: useDateFormatContext().timeZone,
        }),
        {
          withLocalDate: true,
          withOverlay: true,
          di: createTestDi({ ports: { httpClient, queryClient: client } }),
        },
      );

      // When
      await act(async () => {
        await parse.current.mutation.mutateAsync({
          content: originalMemo.content,
          categoryId: 1,
          sourceUpdatedAt: toEpochMs(toMemo(originalMemo).updatedAt),
        });
      });

      // Then
      const draft = draftService.restore(
        createMemoPlanDraftKey({
          userId: 'account-1',
          memoId: 5,
          timeZone: parse.current.timeZone,
        }),
        { sourceUpdatedAt: Date.parse('2026-10-02T00:05:00.000Z') },
      );
      expect(draft.status).toBe('restored');
    });
  });

  describe('오프라인에서 AI 정리', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('멈춰 기다리지 않고 바로 실패해 연결될 때 나도 모르게 차감되지 않는다', async () => {
      // Given
      onlineManager.setOnline(false);
      const httpClient = createHttpClientStub();
      const { result: mutation } = await renderScreenHook(
        () => useMutation(useParseMemoMutationOptions({ memoId: 5 })),
        {
          di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
          withLocalDate: true,
          withOverlay: true,
        },
      );

      // When
      const result = mutation.current.mutateAsync({
        content: '메모',
        categoryId: 1,
        sourceUpdatedAt: 0,
      });

      // Then
      await expect(result).rejects.toBeInstanceOf(NetworkError);
      expect(httpClient.post).not.toHaveBeenCalled();
    });
  });
});

describe('useConvertMemoToTodosMutationOptions', () => {
  describe('오프라인에서 할 일로 바꾸기', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('멈춰 기다리지 않고 요청을 보내 바로 실패한다', async () => {
      // Given
      onlineManager.setOnline(false);
      const httpClient = createHttpClientStub();
      httpClient.post.mockRejectedValue(new NetworkError());
      const { result: mutation } = await renderScreenHook(
        () => useMutation(useConvertMemoToTodosMutationOptions()),
        {
          di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
          withOverlay: true,
        },
      );

      // When
      const result = mutation.current.mutateAsync({
        memoId: 5,
        values: {
          title: '메모',
          startDate: createDateKey('2026-10-02'),
          endDate: null,
          scheduledTime: null,
          isAllDay: true,
          categoryId: 1,
          visibility: 'PUBLIC',
          repeat: null,
        },
      });

      // Then
      await expect(result).rejects.toBeInstanceOf(NetworkError);
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useDeleteMemoMutationOptions', () => {
  describe('오프라인에서 메모 삭제', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('멈춰 기다리지 않고 바로 실패해 연결 문제를 알린다', async () => {
      // Given
      onlineManager.setOnline(false);
      const httpClient = createHttpClientStub();
      httpClient.delete.mockRejectedValue(new NetworkError());
      const { result: mutation } = await renderScreenHook(
        () => useMutation(useDeleteMemoMutationOptions()),
        {
          di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
        },
      );

      // When
      const result = mutation.current.mutateAsync(5);

      // Then
      await expect(result).rejects.toBeInstanceOf(NetworkError);
      // HeroUI가 높이를 재려고 같은 토스트를 하나 더 그린다
      expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    });
  });
});
