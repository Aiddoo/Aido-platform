import '@src/shared/i18n/init';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { createCoachmarkRepository } from '@src/features/feature-discovery/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { MemoService } from '@src/features/memo/apis/memo.service';
import { MEMO_QUERY_KEYS } from '@src/features/memo/constants/memo-query-keys';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { UserService } from '@src/features/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { createVoiceNoteFixture } from '@src/features/voice/__tests__/voice-note.factories';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import {
  createErrorReporterStub,
  createHapticsStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
  createMockTokenStore,
  createSpeechRecognizerStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { MemoList } from './memo-list';

jest.mock('@src/shared/config/env', () => ({ ENV: { API_URL: 'http://test' } }));

const ACCOUNT_ID = 'account-1';
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
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
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        memoService: new MemoService(httpClient),
        userService: new UserService(httpClient),
        entitlementService: new EntitlementService(httpClient, logger),
        authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
        coachmarkService: new CoachmarkService(
          createCoachmarkRepository(createMemorySyncStorage()),
        ),
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer: createSpeechRecognizerStub(),
        haptics: createHapticsStub(),
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
