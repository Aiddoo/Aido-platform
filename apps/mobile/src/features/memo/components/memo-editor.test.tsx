import '@src/shared/i18n/init';
import { TodoCategoryService } from '@src/features/todo/apis/todo-category.service';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { createMemorySyncStorage, createMockHttpClient } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { ApiError } from '@src/shared/errors/api-error';
import { NetworkError } from '@src/shared/errors/infra-error';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

import { createMemo } from '../__tests__/memo.fixtures';
import { createMemoTestDi } from '../__tests__/memo.test-utils';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import { MemoEditor } from './memo-editor';

const MEMO_ID = 5;
const SAVED_MEMO_DTO = {
  id: MEMO_ID,
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  content: '고친 메모',
  isPinned: false,
  sortOrder: 0,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:01:00.000Z',
};

async function renderEditor(toolbar: 'stack' | 'pane') {
  jest.mocked(useLocalSearchParams).mockReturnValue({ memoId: String(MEMO_ID) });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'account-1' });
  queryClient.setQueryData(
    MEMO_QUERY_KEYS.detail({ memoId: MEMO_ID }),
    createMemo({ id: MEMO_ID, content: '처음 메모' }),
  );
  const httpClient = createMockHttpClient();
  httpClient.get.mockImplementation((url) =>
    url === `v1/memos/${MEMO_ID}`
      ? Promise.resolve(ok({ memo: SAVED_MEMO_DTO }))
      : new Promise(() => undefined),
  );
  const onLeave = jest.fn();

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <Suspense fallback={null}>
          <MemoEditor
            toolbar={toolbar === 'stack' ? MemoEditor.StackToolbar : MemoEditor.PaneToolbar}
            onLeave={onLeave}
          />
        </Suspense>
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        ...createMemoTestDi(httpClient),
        todoCategoryService: new TodoCategoryService(httpClient),
        draftService: new DraftService(createDraftRepository(createMemorySyncStorage())),
      },
    },
  );

  return { httpClient, onLeave };
}

async function editContent(content: string) {
  const input = await screen.findByDisplayValue('처음 메모');
  await act(async () => {
    fireEvent(input, 'focus');
    fireEvent.changeText(input, content);
  });
}

describe('MemoEditor', () => {
  it('저장 버튼은 입력칸에 들어간 뒤에 나타나고, 앞뒤 공백을 뺀 글자로 저장한다', async () => {
    // Given
    const { httpClient } = await renderEditor('pane');
    httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
    expect(screen.queryByLabelText('저장')).toBeNull();

    // When
    await editContent('  고친 메모  ');
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('저장'));
    });

    // Then
    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
        content: '고친 메모',
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
    expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
  });

  it('공백만 넣고 저장하면 요청 없이 편집을 끝낸다', async () => {
    // Given
    const { httpClient } = await renderEditor('pane');

    // When
    await editContent('처음 메모  ');
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('저장'));
    });

    // Then
    await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('고친 글자가 있으면 뒤로 갈 때 저장한 뒤 떠난다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
    await editContent('고친 메모');

    // When
    await waitFor(() => expect(screen.getByLabelText('뒤로 가기')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('고친 글자가 없으면 저장 요청 없이 떠난다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    await screen.findByDisplayValue('처음 메모');

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('서버가 거절하면 글자를 지키려고 화면에 남는다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    httpClient.patch.mockResolvedValue(err(new ApiError('MEMO_2001', '거절', 400)));
    await editContent('고친 메모');

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
  });

  it('연결 문제로 못 보내면 초안에 남기고 떠난다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    httpClient.patch.mockRejectedValue(new NetworkError());
    await editContent('고친 메모');

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
  });
});
