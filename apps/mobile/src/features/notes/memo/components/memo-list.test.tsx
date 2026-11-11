import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import '@src/shared/i18n/init';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createSpokenVoiceNote } from '@src/features/voice/__tests__/voice-note.fixtures';
import {
  createHttpClientStub,
  createSpeechRecognizerStub,
  createVoiceNoteStorageFake,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { MEMO_QUERY_KEYS } from '../queries/memo-query-keys';
import { MemoList } from './memo-list';

const ACCOUNT_ID = 'account-1';
const EMPTY_TITLE = '아직 메모가 없어요';

async function renderMemoList({ hasVoiceNote }: { hasVoiceNote: boolean }) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [undefined],
  });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const voiceNoteStorage = createVoiceNoteStorageFake();
  if (hasVoiceNote) {
    voiceNoteStorage.drafts.save(ACCOUNT_ID, createSpokenVoiceNote());
  }

  await renderUi(
    <Suspense fallback={null}>
      <MemoList />
    </Suspense>,
    {
      queryClient,
      withLocalDate: true,
      withOverlay: true,
      di: {
        httpClient,
        speechRecognizer: createSpeechRecognizerStub(),
        ...voiceNoteStorage.di,
      },
    },
  );
}

describe('MemoList', () => {
  it('메모도 말로 남긴 메모도 없으면 빈 화면을 보여 준다', async () => {
    // When
    await renderMemoList({ hasVoiceNote: false });

    // Then
    expect(await screen.findByText(EMPTY_TITLE)).toBeTruthy();
  });

  it('말로 남긴 메모가 있으면 메모가 없다는 빈 화면을 숨긴다', async () => {
    // When
    await renderMemoList({ hasVoiceNote: true });

    // Then
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
  });
});
