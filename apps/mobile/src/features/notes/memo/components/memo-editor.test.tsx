import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import {
  createHttpClientStub,
  createMemorySyncStorage,
  createSpeechRecognizerStub,
  createVoiceNoteStorageFake,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors/infra-error';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { Keyboard } from 'react-native';

import { createMemo } from '../__tests__/memo.fixtures';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import { MemoEditor } from './memo-editor';
import { MemoList } from './memo-list';

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

async function renderEditor(toolbar: 'stack' | 'pane', { withList = false } = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ memoId: String(MEMO_ID) });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'account-1' });
  queryClient.setQueryData(
    MEMO_QUERY_KEYS.detail({ memoId: MEMO_ID }),
    createMemo({ id: MEMO_ID, content: '처음 메모' }),
  );
  queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
    pages: [
      {
        items: [createMemo({ id: MEMO_ID, content: '처음 메모' })],
        hasNext: false,
        nextCursor: null,
      },
    ],
    pageParams: [null],
  });
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation((url) =>
    url === `v1/memos/${MEMO_ID}`
      ? Promise.resolve(ok({ memo: SAVED_MEMO_DTO }))
      : new Promise(() => undefined),
  );
  const onLeave = jest.fn();

  await renderUi(
    <Suspense fallback={null}>
      {withList && <MemoList />}
      <MemoEditor
        toolbar={toolbar === 'stack' ? MemoEditor.StackToolbar : MemoEditor.PaneToolbar}
        onLeave={onLeave}
      />
    </Suspense>,
    {
      queryClient,
      withLocalDate: true,
      withOverlay: true,
      di: {
        httpClient,
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer: createSpeechRecognizerStub(),
        ...createVoiceNoteStorageFake().di,
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

  it('뒤로 가기로 저장하면 목록을 다시 받기 전에도 목록에 새 글이 보인다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack', { withList: true });
    httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
    await editContent('고친 메모');
    expect(screen.getByText('처음 메모')).toBeTruthy();

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(screen.getByText('고친 메모')).toBeTruthy();
    expect(screen.queryByText('처음 메모')).toBeNull();
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

  describe('저장 버튼과 뒤로 가기의 차이', () => {
    let dismissKeyboard: jest.SpyInstance;

    beforeEach(() => {
      dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    });

    afterEach(() => {
      dismissKeyboard.mockRestore();
    });

    it('저장 버튼은 화면에 남은 채 키보드를 내리고 편집을 끝낸다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('pane');
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(dismissKeyboard).toHaveBeenCalledTimes(1);
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('저장 버튼으로 저장한 뒤에는 바뀐 글자가 없어 뒤로 가기가 다시 보내지 않는다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('stack');
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      await editContent('고친 메모');
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });
      await waitFor(() => expect(dismissKeyboard).toHaveBeenCalledTimes(1));

      // When
      await act(async () => {
        fireEvent.press(screen.getByLabelText('뒤로 가기'));
      });

      // Then
      await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
    });

    it('저장 버튼이 거절되면 글자와 편집 상태를 그대로 두고 키보드도 내리지 않는다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('pane');
      httpClient.patch.mockResolvedValue(err(new ApiError('MEMO_2001', '거절', 400)));
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText('저장')).toBeTruthy();
      expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
      expect(dismissKeyboard).not.toHaveBeenCalled();
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('저장 버튼은 연결 문제여도 떠나지 않고 편집을 이어 가게 한다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('pane');
      httpClient.patch.mockRejectedValue(new NetworkError());
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText('저장')).toBeTruthy();
      expect(dismissKeyboard).not.toHaveBeenCalled();
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('뒤로 가기로 저장하면 키보드를 직접 내리지 않고 떠난다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('stack');
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(screen.getByLabelText('뒤로 가기'));
      });

      // Then
      await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
      expect(dismissKeyboard).not.toHaveBeenCalled();
    });
  });
});
