import type { Memo as MemoDto } from '@aido/api';
import {
  createHapticsStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { NetworkError } from '@src/shared/errors/infra-error';
import { ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { onlineManager, type QueryClient, useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { createMemoTestDi } from '../__tests__/memo.test-utils';
import { toMemo } from '../apis/memo.mapper';
import { MemoService } from '../apis/memo.service';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import type { Memo } from '../schemas/memo.schema';
import { useParseMemoMutationOptions, useUpdateMemoMutationOptions } from './memo.mutations';

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

function createLoggerStub() {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

async function updateMemo(client: QueryClient) {
  const httpClient = createMockHttpClient();
  httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: updatedMemo }));
  let options: ReturnType<typeof useUpdateMemoMutationOptions> | undefined;
  function CaptureOptions() {
    options = useUpdateMemoMutationOptions();
    return null;
  }
  const { unmount } = await renderUi(<CaptureOptions />, {
    queryClient: client,
    di: {
      memoService: new MemoService(httpClient, createLoggerStub()),
      haptics: createHapticsStub(),
      analytics: createMockAnalytics(),
    },
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
    // Given: 상세 cache에 옛 메모가 있다

    // When
    await updateMemo(client);

    // Then
    expect(client.getQueryData<Memo>(MEMO_QUERY_KEYS.detail({ memoId: 5 }))).toEqual(
      toMemo(updatedMemo),
    );
  });

  it('저장 이전에 시작한 상세 조회가 늦게 끝나도 수정 내용을 덮어쓰지 않는다', async () => {
    // Given
    let resolveRefresh: (memo: Memo) => void = () => {
      throw new Error('Deferred refresh is not initialized');
    };
    const staleResponse = new Promise<Memo>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = client
      .fetchQuery({
        queryKey: MEMO_QUERY_KEYS.detail({ memoId: 5 }),
        queryFn: () => staleResponse,
      })
      .catch(() => undefined);

    // When
    await updateMemo(client);
    resolveRefresh(toMemo(originalMemo));
    await refresh;

    // Then
    expect(client.getQueryData<Memo>(MEMO_QUERY_KEYS.detail({ memoId: 5 }))).toEqual(
      toMemo(updatedMemo),
    );
  });
});

describe('오프라인에서 AI 정리', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('멈춰 기다리지 않고 바로 실패해 연결될 때 나도 모르게 차감되지 않는다', async () => {
    // Given
    onlineManager.setOnline(false);
    const httpClient = createMockHttpClient();
    let mutateAsync: ReturnType<typeof useMutationCapture> | undefined;
    function useMutationCapture() {
      return useMutation(useParseMemoMutationOptions({ memoId: 5 })).mutateAsync;
    }
    function Capture() {
      mutateAsync = useMutationCapture();
      return null;
    }
    await renderUi(
      <LocalDateProvider>
        <OverlayProvider>
          <Capture />
        </OverlayProvider>
      </LocalDateProvider>,
      {
        di: {
          ...createMemoTestDi(httpClient),
          haptics: createHapticsStub(),
          draftService: new DraftService(createDraftRepository(createMemorySyncStorage())),
        },
      },
    );

    // When
    const result = mutateAsync?.({ content: '메모', categoryId: 1, sourceUpdatedAt: 0 });

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(httpClient.post).not.toHaveBeenCalled();
  });
});
