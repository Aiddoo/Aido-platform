import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import '@src/shared/i18n/init';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createAllSeenCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/queries/todo-category-query-keys';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createLoggerStub,
  createMemoryStorage,
  createSpeechRecognizerStub,
  createVoiceNoteStorageFake,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useIsFocused } from 'expo-router';

import VoiceNoteRecordRoute from '../../../../app/(app)/voice-notes/record';

const ACCOUNT_ID = 'user-1';
let logger: ReturnType<typeof createLoggerStub>;

beforeEach(() => {
  logger = createLoggerStub();
});

async function renderRecordScreen(snapshot = createEntitlementSnapshot()) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const storage = createVoiceNoteStorageFake();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), { categories: [] });

  await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <VoiceNoteRecordRoute />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        httpClient,
        syncStorage: createAllSeenCoachmarkStorage(ACCOUNT_ID).syncStorage,
        storage: createMemoryStorage(),
        speechRecognizer,
        ...storage.di,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsGatewayStub(),
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
  it('화면이 열리면 듣기를 시작하고 무료 사용자의 남은 시간을 서버 값으로 보여 준다', async () => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier: 'FREE' });

    // When
    await renderRecordScreen(snapshot);

    // Then
    expect(screen.getByText('3:00 남음')).toBeTruthy();
    expect(screen.getByTestId('voice-note-pause')).toBeTruthy();
  });

  it('알림을 눌러 다른 화면이 올라오면 듣기를 멈추고 들은 내용을 남긴다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');

    // When
    jest.mocked(useIsFocused).mockReturnValueOnce(false);
    await say(speechRecognizer, '둘째 문장.');

    // Then
    expect(speechRecognizer.stop).toHaveBeenCalled();
    expect(screen.getByTestId('voice-note-resume')).toBeTruthy();
    expect(screen.getByText('첫 문장.')).toBeTruthy();
  });

  it('일시정지하면 들은 내용이 남아 있다고 알리고 이어서 녹음과 여기까지 정리를 보인다', async () => {
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

  it('들은 내용 없이 일시정지하면 남아 있다고 말하지 않고 닫기와 이어서 녹음을 보인다', async () => {
    // Given
    await renderRecordScreen();

    // When
    await fireEvent.press(screen.getByTestId('voice-note-pause'));

    // Then
    expect(screen.getByText('아직 들은 내용은 없어요.')).toBeTruthy();
    expect(screen.queryByText(/모두 남아 있어요/)).toBeNull();
    expect(screen.queryByTestId('voice-note-summarize')).toBeNull();
    expect(screen.getByTestId('voice-note-resume')).toBeTruthy();
  });

  it('들은 내용 없이 멈춘 화면에서 닫으면 초안 없이 나간다', async () => {
    // Given
    const { storage } = await renderRecordScreen();
    await fireEvent.press(screen.getByTestId('voice-note-pause'));

    // When
    await fireEvent.press(screen.getByTestId('voice-note-stopped-close'));

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(storage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
  });

  it('글자를 못 받고 인식이 실패하면 남아 있다고 말하지 않고 닫을 수 있다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();

    // When
    await act(async () => speechRecognizer.emit({ type: 'error', code: 'audio-capture' }));

    // Then
    expect(screen.getByText('녹음이 멈췄어요')).toBeTruthy();
    expect(screen.getByText(/아직 들은 내용은 없어요/)).toBeTruthy();
    expect(screen.queryByText(/모두 남아 있어요/)).toBeNull();
    expect(screen.getByTestId('voice-note-stopped-close')).toBeTruthy();
  });

  it('들은 내용 없이 끝내기를 누르면 이유를 묻고 그대로 두면 계속 듣는다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();

    // When
    await act(async () => {
      fireEvent.press(screen.getByTestId('voice-note-finish')).catch(jest.fn());
    });
    await fireEvent.press(await screen.findByText('계속 녹음'));

    // Then
    expect(speechRecognizer.stop).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('들은 내용 없이 끝내기를 확인하면 남기지 않고 나간다', async () => {
    // Given
    const { speechRecognizer, storage } = await renderRecordScreen();
    await act(async () => {
      fireEvent.press(screen.getByTestId('voice-note-finish')).catch(jest.fn());
    });
    await screen.findByText('아직 들은 내용이 없어요');

    // When
    await fireEvent.press(screen.getAllByText('끝내기').at(-1) ?? screen.getByText('계속 녹음'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
    expect(storage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
  });

  describe('한도를 다 쓴 녹음', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    it('들은 내용 없이 한도를 다 쓰면 정리해준다고 말하지 않고 정리 버튼도 두지 않는다', async () => {
      // Given
      await renderRecordScreen(createEntitlementSnapshot({ tier: 'FREE' }));

      // When
      await act(async () => jest.advanceTimersByTime(181_000));

      // Then
      expect(await screen.findByText(/정리할 게 없어요. 프리미엄은/)).toBeTruthy();
      expect(screen.queryByText(/정리해드릴게요/)).toBeNull();
      expect(screen.queryByTestId('voice-note-summarize')).toBeNull();
      expect(screen.getByTestId('voice-note-stopped-close')).toBeTruthy();
    });
  });

  it('끝내면 초안을 저장하고 정리 화면으로 바꾼다', async () => {
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

  it('글자가 없을 때 닫으면 초안 없이 바로 나간다', async () => {
    // Given
    const { storage } = await renderRecordScreen();

    // When
    await fireEvent.press(screen.getByLabelText('닫기'));

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(storage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
  });

  it('글자가 있을 때 닫으면 바로 나가지 않고 묻는다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('닫기')).catch(jest.fn());
    });

    // Then
    expect(await screen.findByText('녹음을 끝낼까요?')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('이어서 녹음을 누른 직후 닫아도 글자가 있으면 지우지 않고 묻는다', async () => {
    // Given
    const { speechRecognizer, storage } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('voice-note-pause'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await fireEvent.press(screen.getByTestId('voice-note-resume'));

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('닫기')).catch(jest.fn());
    });

    // Then
    expect(await screen.findByText('녹음을 끝낼까요?')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(storage.drafts.findAll(ACCOUNT_ID)).toHaveLength(1);
  });

  it('듣기 시작 전에 끝내기를 확인해도 글자를 들고 정리 화면으로 넘어간다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('voice-note-pause'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await fireEvent.press(screen.getByTestId('voice-note-resume'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('닫기')).catch(jest.fn());
    });

    // When
    await screen.findByText('녹음을 끝낼까요?');
    await fireEvent.press(screen.getAllByText('끝내기').at(-1) ?? screen.getByText('계속 녹음'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(router.back).not.toHaveBeenCalled();
  });

  describe('시작 신호가 없는 이어 듣기', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    it('인식기가 시작 신호를 주지 않으면 잠시 뒤 멈추지 않고 실패로 알린다', async () => {
      // Given
      const { speechRecognizer } = await renderRecordScreen();
      await say(speechRecognizer, '첫 문장.');
      await fireEvent.press(screen.getByTestId('voice-note-pause'));
      await act(async () => speechRecognizer.emit({ type: 'end' }));
      await fireEvent.press(screen.getByTestId('voice-note-resume'));

      // When
      await act(async () => jest.advanceTimersByTime(11_000));

      // Then
      expect(screen.getByTestId('voice-note-summarize')).toBeTruthy();
    });
  });

  it('언어를 바꿀 때 그 언어에 필요한 권한을 거절하면 듣던 언어로 이어 간다', async () => {
    // Given
    const { speechRecognizer } = await renderRecordScreen();
    const denied = { isGranted: false, canAskAgain: true, missing: 'microphone' } as const;
    speechRecognizer.getPermission.mockResolvedValue(denied);
    speechRecognizer.requestPermission.mockResolvedValue(denied);

    // When
    await fireEvent.press(screen.getByText('English'));

    // Then
    await waitFor(() =>
      expect(speechRecognizer.requestPermission).toHaveBeenCalledWith('note', 'en-US'),
    );
    expect(speechRecognizer.stop).not.toHaveBeenCalled();
    expect(speechRecognizer.start).toHaveBeenCalledTimes(1);
  });
});
