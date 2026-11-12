import type { Memo as MemoDto } from '@aido/api';
import { useDraftService } from '@src/bootstrap/providers/di-context';
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
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { onlineManager, type QueryClient, useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { createParseMemoResponseDto } from '../__tests__/parsed-memo.fixtures';
import { toMemo } from '../apis/memo.mapper';
import type { Memo } from '../domains/memo.model';
import { createMemoDraftKey } from '../utils/memo-draft';
import { createMemoPlanDraftKey, createMemoPlanRequestDraftKey } from '../utils/memo-plan-draft';
import { MEMO_QUERY_KEYS } from './memo-query-keys';
import {
  useConvertMemoToTodosMutationOptions,
  useDeleteMemoMutationOptions,
  useParseMemoMutationOptions,
  useSetMemoPinnedMutationOptions,
  useUpdateMemoMutationOptions,
} from './memo.mutations';

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
  let options: ReturnType<typeof useUpdateMemoMutationOptions> | undefined;
  function CaptureOptions() {
    options = useUpdateMemoMutationOptions();
    return null;
  }
  const { unmount } = await renderScreen(<CaptureOptions />, {
    di: createTestDi({
      ports: {
        httpClient,
        haptics: createHapticsGatewayStub(),
        analytics: createAnalyticsStub(),
        queryClient: client,
      },
    }),
  });
  if (options == null) {
    throw new Error('mutation 옵션을 받지 못했다');
  }
  const mutation = client.getMutationCache().build(client, options);

  await act(async () => {
    await mutation.execute({ memoId: 5, values: { content: updatedMemo.content } });
  });
  await unmount();
}

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
    expect(client.getQueryState(MEMO_QUERY_KEYS.detail({ memoId: 5 }))?.isInvalidated).toBe(false);
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
    let mutateAsync: ReturnType<typeof useMutationCapture> | undefined;
    let draftService: ReturnType<typeof useDraftService> | undefined;
    function useMutationCapture() {
      return useMutation(useSetMemoPinnedMutationOptions()).mutateAsync;
    }
    function Capture() {
      mutateAsync = useMutationCapture();
      draftService = useDraftService();
      return null;
    }
    await renderScreen(<Capture />, {
      di: createTestDi({
        ports: {
          httpClient,
          haptics: createHapticsGatewayStub(),
          analytics: createAnalyticsStub(),
          queryClient: client,
        },
      }),
      withLocalDate: true,
    });
    const inputKey = createMemoDraftKey({ userId: 'account-1', memoId: 5 });
    const requestKey = createMemoPlanRequestDraftKey({ userId: 'account-1', memoId: 5 });
    const beforeEpoch = toEpochMs(toMemo(originalMemo).updatedAt);
    draftService?.save(inputKey, { content: '쓰던 글' }, { sourceUpdatedAt: beforeEpoch });
    draftService?.save(
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
      await mutateAsync?.({ memoId: 5, isPinned: true });
    });

    // Then
    const afterEpoch = toEpochMs(toMemo(pinnedMemo).updatedAt);
    expect(draftService?.restore(inputKey, { sourceUpdatedAt: afterEpoch }).status).toBe(
      'restored',
    );
    expect(draftService?.restore(requestKey, { sourceUpdatedAt: afterEpoch }).status).toBe(
      'restored',
    );
  });

  it('오프라인이면 멈춰 기다리지 않고 바로 실패해 안내한다', async () => {
    // Given
    onlineManager.setOnline(false);
    const httpClient = createHttpClientStub();
    httpClient.patch.mockRejectedValue(new NetworkError());
    let mutateAsync: ReturnType<typeof useMutationCapture> | undefined;
    function useMutationCapture() {
      return useMutation(useSetMemoPinnedMutationOptions()).mutateAsync;
    }
    function Capture() {
      mutateAsync = useMutationCapture();
      return null;
    }
    await renderScreen(<Capture />, {
      di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
      withLocalDate: true,
    });

    // When
    const result = mutateAsync?.({ memoId: 5, isPinned: true });

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });
});

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
    let mutateAsync: ReturnType<typeof useMutationCapture> | undefined;
    let draftService: ReturnType<typeof useDraftService> | undefined;
    let timeZone = '';
    function useMutationCapture() {
      return useMutation(useParseMemoMutationOptions({ memoId: 5 })).mutateAsync;
    }
    function Capture() {
      mutateAsync = useMutationCapture();
      draftService = useDraftService();
      timeZone = useDateFormatContext().timeZone;
      return null;
    }
    await renderScreen(<Capture />, {
      withLocalDate: true,
      withOverlay: true,
      di: createTestDi({ ports: { httpClient, queryClient: client } }),
    });

    // When
    await act(async () => {
      await mutateAsync?.({
        content: originalMemo.content,
        categoryId: 1,
        sourceUpdatedAt: toEpochMs(toMemo(originalMemo).updatedAt),
      });
    });

    // Then
    const draft = draftService?.restore(
      createMemoPlanDraftKey({ userId: 'account-1', memoId: 5, timeZone }),
      { sourceUpdatedAt: Date.parse('2026-10-02T00:05:00.000Z') },
    );
    expect(draft?.status).toBe('restored');
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
    let mutateAsync: ReturnType<typeof useMutationCapture> | undefined;
    function useMutationCapture() {
      return useMutation(useParseMemoMutationOptions({ memoId: 5 })).mutateAsync;
    }
    function Capture() {
      mutateAsync = useMutationCapture();
      return null;
    }
    await renderScreen(<Capture />, {
      di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
      withLocalDate: true,
      withOverlay: true,
    });

    // When
    const result = mutateAsync?.({ content: '메모', categoryId: 1, sourceUpdatedAt: 0 });

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(httpClient.post).not.toHaveBeenCalled();
  });
});

describe('오프라인에서 할 일로 바꾸기', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('멈춰 기다리지 않고 요청을 보내 바로 실패한다', async () => {
    // Given
    onlineManager.setOnline(false);
    const httpClient = createHttpClientStub();
    httpClient.post.mockRejectedValue(new NetworkError());
    let mutateAsync: ReturnType<typeof useMutationCapture> | undefined;
    function useMutationCapture() {
      return useMutation(useConvertMemoToTodosMutationOptions()).mutateAsync;
    }
    function Capture() {
      mutateAsync = useMutationCapture();
      return null;
    }
    await renderScreen(<Capture />, {
      di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
      withOverlay: true,
    });

    // When
    const result = mutateAsync?.({
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

describe('오프라인에서 메모 삭제', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('멈춰 기다리지 않고 바로 실패해 연결 문제를 알린다', async () => {
    // Given
    onlineManager.setOnline(false);
    const httpClient = createHttpClientStub();
    httpClient.delete.mockRejectedValue(new NetworkError());
    let mutateAsync: ReturnType<typeof useMutationCapture> | undefined;
    function useMutationCapture() {
      return useMutation(useDeleteMemoMutationOptions()).mutateAsync;
    }
    function Capture() {
      mutateAsync = useMutationCapture();
      return null;
    }
    await renderScreen(<Capture />, {
      di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
    });

    // When
    const result = mutateAsync?.(5);

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    // HeroUI가 높이를 재려고 같은 토스트를 하나 더 그린다
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
  });
});
