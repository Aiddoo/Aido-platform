import '@src/shared/i18n/init';
import {
  createErrorReporterStub,
  createHapticsStub,
  createMockAnalytics,
  createSpeechRecognizerStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { OverlayProvider, Text } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { createVoiceNoteFixture, createVoiceNoteSentence } from '../__tests__/voice-note.factories';
import { useVoiceNoteRecording } from './use-voice-note-recording';

const ACCOUNT_ID = 'user-1';
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

interface ProbeProps {
  seedDraftId?: string;
  entry?: 'memo_tab' | 'quick_voice_upgrade';
  maxSeconds: number | null;
  onLimitReached: () => void;
  onFinished: (draftId: string) => void;
  onEmpty: () => void;
}

function RecordingProbe(props: ProbeProps) {
  const recording = useVoiceNoteRecording({ accountId: ACCOUNT_ID, locale: 'ko-KR', ...props });

  return (
    <>
      <Pressable
        testID="start"
        onPress={() => {
          recording.start({ startLocale: 'ko-KR', contextualStrings: [] }).catch(jest.fn());
        }}
      />
      <Pressable testID="pause" onPress={recording.pause} />
      <Pressable testID="resume" onPress={recording.resume} />
      <Pressable testID="finish" onPress={recording.finish} />
      <Pressable testID="mark" onPress={recording.mark} />
      <Text testID="status">{recording.state.status}</Text>
      <Text testID="draft-id">{recording.draftId}</Text>
      <Text testID="captions">{recording.sentences.map(({ text }) => text).join('|')}</Text>
      <Text testID="interim">{recording.interimText}</Text>
    </>
  );
}

async function renderRecording({
  maxSeconds = null,
  canDownloadOnDeviceModel = false,
}: { maxSeconds?: number | null; canDownloadOnDeviceModel?: boolean } = {}) {
  const speechRecognizer = createSpeechRecognizerStub();
  speechRecognizer.getCapabilities.mockResolvedValue({
    isAvailable: true,
    canRecognizeOnDevice: !canDownloadOnDeviceModel,
    canDownloadOnDeviceModel,
    canSaveRecording: true,
    canContinue: true,
  });
  const storage = createVoiceNoteStorageServiceFake();
  const analytics = createMockAnalytics();
  const handlers = {
    onLimitReached: jest.fn(),
    onFinished: jest.fn(),
    onEmpty: jest.fn(),
  };

  await renderUi(
    <OverlayProvider>
      <RecordingProbe maxSeconds={maxSeconds} {...handlers} />
    </OverlayProvider>,
    {
      di: {
        speechRecognizer,
        voiceNoteStorageService: storage,
        analytics,
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsStub(),
        logger,
      },
    },
  );

  return { speechRecognizer, storage, analytics, ...handlers };
}

const start = async (speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>) => {
  await fireEvent.press(screen.getByTestId('start'));
  await act(async () => speechRecognizer.emit({ type: 'start' }));
};

const say = (
  speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
  transcript: string,
  isFinal = true,
) => act(async () => speechRecognizer.emit({ type: 'result', transcript, isFinal, segments: [] }));

describe('useVoiceNoteRecording', () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('기기 인식과 녹음 파일 저장으로 시작하고 말을 끝내도 알아서 끝나지 않는다', async () => {
    // Given
    const { speechRecognizer } = await renderRecording();

    // When
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');
    await act(async () => speechRecognizer.emit({ type: 'volume', level: 0 }));
    await act(async () => jest.advanceTimersByTime(10_000));

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'note',
        isOnDevice: true,
        recordingDirectory: expect.stringContaining('voice-notes'),
      }),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('listening');
  });

  test('확정한 문장을 기기 초안에 저장해 앱이 꺼져도 글자가 남는다', async () => {
    // Given
    const { speechRecognizer, storage } = await renderRecording();
    await start(speechRecognizer);

    // When
    await say(speechRecognizer, '첫 문장.');
    await act(async () => jest.advanceTimersByTime(2_000));

    // Then
    const draftId = screen.getByTestId('draft-id').props.children;
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.sentences.map(({ text }) => text)).toEqual([
      '첫 문장.',
    ]);
  });

  test('일시정지하면 인식기를 멈추고 초안을 바로 저장하며 이어 들으면 다시 시작한다', async () => {
    // Given
    const { speechRecognizer, storage } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '멈추기 전 말', false);

    // When
    await fireEvent.press(screen.getByTestId('pause'));

    // Then
    const draftId = screen.getByTestId('draft-id').props.children;
    expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('paused');
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.sentences).toHaveLength(1);

    // When
    await fireEvent.press(screen.getByTestId('resume'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('status')).toHaveTextContent('listening');
  });

  test('끝내면 글자와 녹음 조각을 저장한 뒤 초안 id로 넘긴다', async () => {
    // Given
    const { speechRecognizer, storage, onFinished } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');

    // When
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () =>
      speechRecognizer.emit({ type: 'recording-saved', uri: 'file:///missing/recording_a.wav' }),
    );
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    const draftId = screen.getByTestId('draft-id').props.children;
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(draftId));
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.sentences).toHaveLength(1);
  });

  test('일시정지 직후 끝내도 녹음 파일이 올 때까지 기다렸다가 조각을 남긴다', async () => {
    // Given
    const { speechRecognizer, storage, onFinished } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('pause'));

    // When
    await fireEvent.press(screen.getByTestId('finish'));

    // Then
    expect(onFinished).not.toHaveBeenCalled();

    // When
    const uri = storage.recordings.prepareDirectory(ACCOUNT_ID);
    await act(async () =>
      speechRecognizer.emit({ type: 'recording-saved', uri: `${uri}/recording_a.wav` }),
    );

    // Then
    const draftId = screen.getByTestId('draft-id').props.children;
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(draftId));
  });

  test('녹음 파일이 끝내 오지 않아도 글자는 넘긴다', async () => {
    // Given
    const { speechRecognizer, onFinished } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('pause'));
    await fireEvent.press(screen.getByTestId('finish'));

    // When
    await act(async () => jest.advanceTimersByTime(3_100));

    // Then
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  test('한 번의 길이 한도에 닿으면 멈추고 알린다', async () => {
    // Given
    const { speechRecognizer, onLimitReached } = await renderRecording({ maxSeconds: 3 });
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');

    // When
    await act(async () => jest.advanceTimersByTime(3_100));

    // Then
    expect(onLimitReached).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('paused');
    expect(speechRecognizer.stop).toHaveBeenCalled();
  });

  test('들은 글자 없이 끝내면 초안을 남기지 않고 알린다', async () => {
    // Given
    const { speechRecognizer, storage, onEmpty } = await renderRecording();
    await start(speechRecognizer);

    // When
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(storage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
  });

  test('빠른 말하기에서 넘어온 초안은 글자와 시간을 이어 듣고 진입 경로를 남긴다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const storage = createVoiceNoteStorageServiceFake();
    const analytics = createMockAnalytics();
    const seed = createVoiceNoteFixture({
      draftId: 'seed-1',
      durationMs: 90_000,
      recordings: [],
      sentences: [createVoiceNoteSentence({ text: '앞에서 한 말.', startMs: 0, endMs: 90_000 })],
    });
    storage.drafts.save(ACCOUNT_ID, seed);
    await renderUi(
      <OverlayProvider>
        <RecordingProbe
          seedDraftId="seed-1"
          entry="quick_voice_upgrade"
          maxSeconds={null}
          onLimitReached={jest.fn()}
          onFinished={jest.fn()}
          onEmpty={jest.fn()}
        />
      </OverlayProvider>,
      {
        di: {
          speechRecognizer,
          voiceNoteStorageService: storage,
          analytics,
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      },
    );

    // When
    await start(speechRecognizer);
    await say(speechRecognizer, '이어서 한 말.');
    await act(async () => jest.advanceTimersByTime(2_000));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'voice_capture_started',
      expect.objectContaining({ mode: 'note', entry: 'quick_voice_upgrade' }),
    );
    expect(screen.getByTestId('draft-id')).toHaveTextContent('seed-1');
    const saved = storage.drafts.find(ACCOUNT_ID, 'seed-1');
    expect(saved?.sentences.map(({ text }) => text)).toEqual(['앞에서 한 말.', '이어서 한 말.']);
    expect(saved?.sentences[1]?.startMs).toBeGreaterThanOrEqual(90_000);
  });

  test('말한 내용은 분석에 싣지 않는다', async () => {
    // Given
    const { speechRecognizer, analytics } = await renderRecording();
    await start(speechRecognizer);

    // When
    await say(speechRecognizer, '비밀스러운 회의 내용.');
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(JSON.stringify(analytics.trackEvent.mock.calls)).not.toContain('회의');
  });

  test('Android에 언어 모델이 없으면 받을지 묻고 거절해도 네트워크 인식으로 시작한다', async () => {
    // Given
    const { speechRecognizer, analytics } = await renderRecording({
      canDownloadOnDeviceModel: true,
    });

    // When
    await fireEvent.press(screen.getByTestId('start'));
    await fireEvent.press(await screen.findByText('나중에'));

    // Then
    await waitFor(() =>
      expect(speechRecognizer.start).toHaveBeenCalledWith(
        expect.objectContaining({ isOnDevice: false }),
      ),
    );
    expect(speechRecognizer.requestOfflineModel).not.toHaveBeenCalled();
    expect(analytics.trackEvent).toHaveBeenCalledWith('voice_offline_model_requested', {
      locale: 'ko-KR',
      result: 'declined',
    });
  });

  test('화면이 사라지면 구독을 풀고 듣던 세션을 끊는다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const { unmount } = await renderUi(
      <OverlayProvider>
        <RecordingProbe
          maxSeconds={null}
          onLimitReached={jest.fn()}
          onFinished={jest.fn()}
          onEmpty={jest.fn()}
        />
      </OverlayProvider>,
      {
        di: {
          speechRecognizer,
          voiceNoteStorageService: createVoiceNoteStorageServiceFake(),
          analytics: createMockAnalytics(),
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      },
    );
    await start(speechRecognizer);

    // When
    await act(async () => unmount());

    // Then
    expect(speechRecognizer.abort).toHaveBeenCalledTimes(1);
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });
});
