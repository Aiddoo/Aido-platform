import '@src/shared/i18n/init';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { MEMO_QUERY_KEYS } from '@src/features/notes/memo/constants/memo-query-keys';
import { createVoiceNoteFixture } from '@src/features/voice/__tests__/voice-note.factories';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import {
  createMemorySyncStorage,
  createMockHttpClient,
  createSpeechRecognizerStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createMemoTestDi } from '../__tests__/memo.test-utils';
import { MemoList } from './memo-list';

const ACCOUNT_ID = 'account-1';
const EMPTY_TITLE = '아직 메모가 없어요';

async function renderMemoList({ hasVoiceNote }: { hasVoiceNote: boolean }) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
    pages: [{ items: [], hasNext: false, nextCursor: null }],
    pageParams: [null],
  });
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const voiceNoteStorageService = createVoiceNoteStorageServiceFake();
  if (hasVoiceNote) {
    voiceNoteStorageService.drafts.save(ACCOUNT_ID, createVoiceNoteFixture());
  }

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <Suspense fallback={null}>
          <MemoList />
        </Suspense>
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        ...createMemoTestDi(httpClient),
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer: createSpeechRecognizerStub(),
        voiceNoteStorageService,
      },
    },
  );
}

describe('MemoList', () => {
  it('메모도 말로 남긴 메모도 없으면 빈 화면을 보여 준다', async () => {
    // Given & When
    await renderMemoList({ hasVoiceNote: false });

    // Then
    expect(await screen.findByText(EMPTY_TITLE)).toBeTruthy();
  });

  it('말로 남긴 메모가 있으면 메모가 없다는 빈 화면을 숨긴다', async () => {
    // Given & When
    await renderMemoList({ hasVoiceNote: true });

    // Then
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
  });
});
