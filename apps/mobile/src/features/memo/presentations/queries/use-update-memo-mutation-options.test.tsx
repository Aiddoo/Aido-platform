import type { Memo } from '@aido/validators';
import { createMockHttpClient } from '@src/shared/__tests__';
import { ok } from '@src/shared/errors/result';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { MemoItem } from '../../models/memo.model';
import { toMemoItem } from '../../services/memo.mapper';
import { MemoService } from '../../services/memo.service';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';
import { useUpdateMemoMutationOptions } from './use-update-memo-mutation-options';

let mockMemoService: MemoService;

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useMemoService: () => mockMemoService,
}));
jest.mock('@src/shared/analytics', () => ({ useTrack: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@src/shared/hooks/useAppToast', () => ({ useAppToast: () => ({ error: jest.fn() }) }));

const originalMemo: Memo = {
  id: 5,
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  content: '처음 작성한 메모',
  isPinned: false,
  sortOrder: 0,
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};
const updatedMemo: Memo = {
  ...originalMemo,
  content: '수정하고 저장한 메모',
  updatedAt: '2026-10-02T00:01:00.000Z',
};

describe('메모 수정 후 상세 cache', () => {
  let client: QueryClient;
  let unmount: (() => Promise<void>) | undefined;

  beforeEach(() => {
    client = new QueryClient({
      // Observer 없이 만든 mutation의 GC timer가 테스트 종료를 붙잡지 않게 한다.
      defaultOptions: { queries: { retry: false }, mutations: { gcTime: Infinity } },
    });
    unmount = undefined;
    const http = createMockHttpClient();
    http.patch.mockResolvedValue(ok({ message: 'updated', memo: updatedMemo }));
    mockMemoService = new MemoService(http);
    client.setQueryData(MEMO_QUERY_KEYS.detail(5), toMemoItem(originalMemo));
  });

  afterEach(async () => {
    await unmount?.();
    await client.cancelQueries();
    client.clear();
  });

  const updateMemo = async () => {
    const rendered = await renderHook(() => useUpdateMemoMutationOptions(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    unmount = rendered.unmount;
    const mutation = client.getMutationCache().build(client, rendered.result.current);
    await act(async () => {
      await mutation.execute({ memoId: 5, input: { content: updatedMemo.content } });
    });
  };

  it('저장 완료 후 즉시 다시 열어도 검증된 수정 응답으로 폼을 초기화한다', async () => {
    await updateMemo();

    expect(client.getQueryData<MemoItem>(MEMO_QUERY_KEYS.detail(5))).toEqual(
      toMemoItem(updatedMemo),
    );
  });

  it('저장 이전에 시작한 상세 조회가 늦게 끝나도 수정 내용을 덮어쓰지 않는다', async () => {
    let resolveRefresh: (memo: MemoItem) => void = () => {
      throw new Error('Deferred refresh is not initialized');
    };
    const staleResponse = new Promise<MemoItem>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = client
      .fetchQuery({
        queryKey: MEMO_QUERY_KEYS.detail(5),
        queryFn: () => staleResponse,
      })
      .catch(() => undefined);

    await updateMemo();
    resolveRefresh(toMemoItem(originalMemo));
    await refresh;

    expect(client.getQueryData<MemoItem>(MEMO_QUERY_KEYS.detail(5))).toEqual(
      toMemoItem(updatedMemo),
    );
  });
});
