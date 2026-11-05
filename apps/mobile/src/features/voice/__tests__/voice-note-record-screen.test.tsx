import '@src/shared/i18n/init';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { createEntitlementSnapshot } from '@src/features/subscription/__tests__/entitlement.factories';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/subscription/constants/entitlement-query-keys';
import { TodoCategoryService } from '@src/features/todo/apis/todo-category.service';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/constants/todo-category-query-keys';
import { UserService } from '@src/features/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import {
  createErrorReporterStub,
  createHapticsStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
  createMockStorage,
  createMockTokenStore,
  createSpeechRecognizerStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import VoiceNoteRecordRoute from '../../../../app/(app)/voice-notes/record';
import { createRecognitionLanguageRepository } from '../apis/recognition-language.repository';

// AuthService가 읽는 앱 설정(ENV)은 불러올 때 expo extra를 검사해서, 기존 인증 테스트처럼 설정 모듈만 대체한다
jest.mock('@src/shared/config/env', () => ({ ENV: { API_URL: 'http://localhost:3000' } }));

const ACCOUNT_ID = 'user-1';
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

async function renderRecordScreen(snapshot = createEntitlementSnapshot()) {
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const storage = createVoiceNoteStorageServiceFake();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), { categories: [] });

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <VoiceNoteRecordRoute />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        entitlementService: new EntitlementService(httpClient, logger),
        userService: new UserService(httpClient),
        todoCategoryService: new TodoCategoryService(httpClient),
        authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
        coachmarkService: new CoachmarkService({ isSeen: () => true, markSeen: jest.fn() }),
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        storage: createMockStorage(),
        speechRecognizer,
        voiceNoteStorageService: storage,
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsStub(),
        logger,
      },
    },
  );
  await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalled());
  await act(async () => speechRecognizer.emit({ type: 'start' }));

  return { speechRecognizer, storage };
}

const say = (speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>, transcript: string) =>
  act(async () =>
    speechRecognizer.emit({ type: 'result', transcript, isFinal: true, segments: [] }),
  );

describe('녹음 화면', () => {
  test('화면이 열리면 듣기를 시작하고 무료 사용자의 남은 시간을 서버 값으로 보여 준다', async () => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier: 'FREE' });

    // When
    await renderRecordScreen(snapshot);

    // Then
    expect(screen.getByText('3:00 남음')).toBeTruthy();
    expect(screen.getByTestId('voice-note-pause')).toBeTruthy();
  });

  test('일시정지하면 들은 내용이 남아 있다고 알리고 이어서 녹음과 여기까지 정리를 보인다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');

    // When
    await fireEvent.press(screen.getByTestId('voice-note-pause'));

    // Then
    expect(screen.getByText('잠시 멈췄어요')).toBeTruthy();
    expect(screen.getByTestId('voice-note-resume')).toBeTruthy();
    expect(screen.getByTestId('voice-note-summarize')).toBeTruthy();
    expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
  });

  test('끝내면 초안을 저장하고 정리 화면으로 바꾼다', async () => {
    // Given
    const { speechRecognizer, storage } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');

    // When
    await fireEvent.press(screen.getByTestId('voice-note-finish'));
    await act(async () =>
      speechRecognizer.emit({ type: 'recording-saved', uri: 'file:///recording_a.wav' }),
    );
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(storage.drafts.findAll(ACCOUNT_ID)).toHaveLength(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('글자가 없을 때 닫으면 초안 없이 바로 나간다', async () => {
    // Given
    const { storage } = await renderRecordScreen();

    // When
    await fireEvent.press(screen.getByTestId('voice-note-close'));

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(storage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
  });

  test('글자가 있을 때 닫으면 바로 나가지 않고 묻는다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');

    // When
    await act(async () => {
      fireEvent.press(screen.getByTestId('voice-note-close')).catch(jest.fn());
    });

    // Then
    expect(await screen.findByText('녹음을 끝낼까요?')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  test('이어서 녹음을 누른 직후 닫아도 글자가 있으면 지우지 않고 묻는다', async () => {
    // Given
    const { speechRecognizer, storage } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('voice-note-pause'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await fireEvent.press(screen.getByTestId('voice-note-resume'));

    // When
    await act(async () => {
      fireEvent.press(screen.getByTestId('voice-note-close')).catch(jest.fn());
    });

    // Then
    expect(await screen.findByText('녹음을 끝낼까요?')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(storage.drafts.findAll(ACCOUNT_ID)).toHaveLength(1);
  });

  test('듣기 시작 전에 끝내기를 확인해도 글자를 들고 정리 화면으로 넘어간다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('voice-note-pause'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await fireEvent.press(screen.getByTestId('voice-note-resume'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('voice-note-close')).catch(jest.fn());
    });

    // When
    await screen.findByText('녹음을 끝낼까요?');
    await fireEvent.press(screen.getAllByText('끝내기').at(-1) ?? screen.getByText('계속 녹음'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(router.back).not.toHaveBeenCalled();
  });

  test('인식기가 시작 신호를 주지 않으면 잠시 뒤 멈추지 않고 실패로 알린다', async () => {
    // Given
    jest.useFakeTimers({ advanceTimers: true });
    const { speechRecognizer } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('voice-note-pause'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await fireEvent.press(screen.getByTestId('voice-note-resume'));

    // When
    await act(async () => jest.advanceTimersByTime(11_000));

    // Then
    expect(screen.getByTestId('voice-note-summarize')).toBeTruthy();
    jest.useRealTimers();
  });

  test('언어를 바꿀 때 그 언어에 필요한 권한을 거절하면 듣던 언어로 이어 간다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    speechRecognizer.getPermission.mockResolvedValue({ isGranted: false, canAskAgain: true });
    speechRecognizer.requestPermission.mockResolvedValue({ isGranted: false, canAskAgain: true });

    // When
    await fireEvent.press(screen.getByText('English'));

    // Then
    await waitFor(() =>
      expect(speechRecognizer.requestPermission).toHaveBeenCalledWith('note', 'en-US'),
    );
    expect(speechRecognizer.stop).not.toHaveBeenCalled();
    expect(speechRecognizer.start).toHaveBeenCalledTimes(1);
  });

  test('음량 이벤트가 이어져도 녹음 화면을 다시 그리지 않는다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    const before = screen.toJSON();

    // When
    await act(async () => {
      for (let count = 0; count < 40; count += 1) {
        speechRecognizer.emit({ type: 'volume', level: 0.5 });
      }
    });

    // Then
    expect(screen.toJSON()).toEqual(before);
  });
});
