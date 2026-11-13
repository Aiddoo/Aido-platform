import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
  createVoiceNoteStorageFake,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createMemo } from '../__tests__/memo.fixtures';
import { MEMO_QUERY_KEYS } from '../queries/memo-query-keys';
import { MemoList } from './memo-list';

const MEMO_ID = 5;

describe('MemoList', () => {
  it('스크린리더 동작으로 카드에서 바로 메모를 고정한다', async () => {
    // Given
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
    queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
      pages: [{ items: [createMemo({ id: MEMO_ID, content: '장보기' })], nextCursor: null }],
      pageParams: [undefined],
    });
    const httpClient = createHttpClientStub();
    httpClient.patch.mockResolvedValue(
      ok({
        message: 'updated',
        memo: {
          id: MEMO_ID,
          userId: 'clz7x5p8k0001qz0z8z8z8z8z',
          content: '장보기',
          isPinned: true,
          sortOrder: 0,
          createdAt: '2026-11-06T00:00:00.000Z',
          updatedAt: '2026-11-06T00:01:00.000Z',
        },
      }),
    );
    await renderScreen(
      <Suspense fallback={null}>
        <MemoList />
      </Suspense>,
      {
        di: createTestDi({
          ports: { httpClient, queryClient, ...createVoiceNoteStorageFake().ports },
        }),
        withLocalDate: true,
        withOverlay: true,
      },
    );

    // When
    await fireEvent(await screen.findByTestId(`memo-item-${MEMO_ID}`), 'accessibilityAction', {
      nativeEvent: { actionName: 'togglePin' },
    });

    // Then
    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}/pin`, { isPinned: true }),
    );
  });
});
