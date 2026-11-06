import '@src/shared/i18n/init';
import {
  createErrorReporterStub,
  createHapticsStub,
  createLocalFileSystemFake,
  createMemorySyncStorage,
  createAnalyticsStub,
  createSpeechRecognizerStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { OverlayProvider, Text } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { createVoiceNoteFixture, createVoiceNoteSentence } from '../__tests__/voice-note.factories';
import {
  createOfflineModelPromptRepository,
  type OfflineModelPromptRepository,
} from '../apis/offline-model-prompt.repository';
import { useVoiceNoteRecording } from './use-voice-note-recording';

const ACCOUNT_ID = 'user-1';
const RECORDING_DIRECTORY = ['voice-notes', ACCOUNT_ID];
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
      <Pressable testID="discard" onPress={recording.discard} />
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
  files = createLocalFileSystemFake(),
  offlineModelPromptRepository = createOfflineModelPromptRepository(createMemorySyncStorage()),
}: {
  maxSeconds?: number | null;
  canDownloadOnDeviceModel?: boolean;
  files?: ReturnType<typeof createLocalFileSystemFake>;
  offlineModelPromptRepository?: OfflineModelPromptRepository;
} = {}) {
  const speechRecognizer = createSpeechRecognizerStub();
  speechRecognizer.getCapabilities.mockResolvedValue({
    isAvailable: true,
    canRecognizeOnDevice: !canDownloadOnDeviceModel,
    canDownloadOnDeviceModel,
    canSaveRecording: true,
    canContinue: true,
  });
  const storage = createVoiceNoteStorageServiceFake(files);
  const analytics = createAnalyticsStub();
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
        offlineModelPromptRepository,
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
    await act(async () => speechRecognizer.emit({ type: 'end' }));
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
    const files = createLocalFileSystemFake();
    const uri = files.addFile(RECORDING_DIRECTORY, 'recording_a.wav');
    const { speechRecognizer, storage, onFinished } = await renderRecording({ files });
    await start(speechRecognizer);
    await act(async () => speechRecognizer.emit({ type: 'recording-started', uri }));
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('pause'));

    // When
    await fireEvent.press(screen.getByTestId('finish'));

    // Then
    expect(onFinished).not.toHaveBeenCalled();

    // When
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));

    // Then
    const draftId = screen.getByTestId('draft-id').props.children;
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(draftId));
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.recordings).toHaveLength(1);
  });

  test('끝낼 때 인식기가 final 대신 client로 답해도 듣던 글자까지 초안에 남겨 넘긴다', async () => {
    // Given
    const { speechRecognizer, storage, onFinished } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');
    await say(speechRecognizer, '두 번째 문장', false);

    // When
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await act(async () => jest.advanceTimersByTimeAsync(0));

    // Then
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    const draftId = screen.getByTestId('draft-id').props.children;
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.sentences.map(({ text }) => text)).toEqual([
      '첫 문장.',
      '두 번째 문장',
    ]);
  });

  test('일시정지 뒤 인식기가 client로 답해도 실패가 아니고 들은 글자를 그대로 둔다', async () => {
    // Given
    const { speechRecognizer } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장', false);

    // When
    await fireEvent.press(screen.getByTestId('pause'));
    await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(screen.getByTestId('status')).toHaveTextContent('paused');
    expect(screen.getByTestId('captions')).toHaveTextContent('첫 문장');
  });

  test('녹음 파일을 쓰지 않은 구간(Android 12 이하)은 기다리지 않고 글자를 넘긴다', async () => {
    // Given
    const { speechRecognizer, onFinished } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('pause'));

    // When
    await fireEvent.press(screen.getByTestId('finish'));

    // Then
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  test('녹음 파일이 끝내 오지 않아도 글자는 넘긴다', async () => {
    // Given
    const { speechRecognizer, onFinished } = await renderRecording();
    await start(speechRecognizer);
    await act(async () =>
      speechRecognizer.emit({ type: 'recording-started', uri: 'file:///recording_a.wav' }),
    );
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
    const analytics = createAnalyticsStub();
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

  test('받기를 거절하면 이 사용자의 그 언어로 기억한다', async () => {
    // Given
    const offlineModelPromptRepository =
      createOfflineModelPromptRepository(createMemorySyncStorage());
    await renderRecording({ canDownloadOnDeviceModel: true, offlineModelPromptRepository });

    // When
    await fireEvent.press(screen.getByTestId('start'));
    await fireEvent.press(await screen.findByText('나중에'));

    // Then
    await waitFor(() =>
      expect(offlineModelPromptRepository.hasDeclined(ACCOUNT_ID, 'ko-KR')).toBe(true),
    );
  });

  test.each(['dialog-opened', 'unavailable', 'scheduled'] as const)(
    '받기를 고른 뒤 결과가 %s이면 다음 녹음에 다시 묻지 않는다',
    async (result) => {
      // Given
      const offlineModelPromptRepository =
        createOfflineModelPromptRepository(createMemorySyncStorage());
      const { speechRecognizer } = await renderRecording({
        canDownloadOnDeviceModel: true,
        offlineModelPromptRepository,
      });
      speechRecognizer.requestOfflineModel.mockResolvedValue(result);

      // When
      await fireEvent.press(screen.getByTestId('start'));
      await fireEvent.press(await screen.findByText('받기'));

      // Then
      await waitFor(() =>
        expect(offlineModelPromptRepository.hasDeclined(ACCOUNT_ID, 'ko-KR')).toBe(true),
      );
    },
  );

  test('받기가 끝났으면 거절로 기억하지 않는다', async () => {
    // Given
    const offlineModelPromptRepository =
      createOfflineModelPromptRepository(createMemorySyncStorage());
    const { speechRecognizer } = await renderRecording({
      canDownloadOnDeviceModel: true,
      offlineModelPromptRepository,
    });
    speechRecognizer.requestOfflineModel.mockResolvedValue('downloaded');

    // When
    await fireEvent.press(screen.getByTestId('start'));
    await fireEvent.press(await screen.findByText('받기'));

    // Then
    await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(1));
    expect(offlineModelPromptRepository.hasDeclined(ACCOUNT_ID, 'ko-KR')).toBe(false);
  });

  test('이미 거절한 언어는 묻지 않고 바로 네트워크 인식으로 시작한다', async () => {
    // Given
    const offlineModelPromptRepository =
      createOfflineModelPromptRepository(createMemorySyncStorage());
    offlineModelPromptRepository.saveDeclined(ACCOUNT_ID, 'ko-KR');
    const { speechRecognizer } = await renderRecording({
      canDownloadOnDeviceModel: true,
      offlineModelPromptRepository,
    });

    // When
    await fireEvent.press(screen.getByTestId('start'));

    // Then
    await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('나중에')).toBeNull();
  });

  test('다른 언어를 거절했어도 이 언어는 한 번 묻는다', async () => {
    // Given
    const offlineModelPromptRepository =
      createOfflineModelPromptRepository(createMemorySyncStorage());
    offlineModelPromptRepository.saveDeclined(ACCOUNT_ID, 'en-US');
    await renderRecording({ canDownloadOnDeviceModel: true, offlineModelPromptRepository });

    // When
    await fireEvent.press(screen.getByTestId('start'));

    // Then
    expect(await screen.findByText('나중에')).toBeTruthy();
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
          analytics: createAnalyticsStub(),
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

  test('끝내서 넘긴 뒤에는 들은 글자 없음 안내와 뒤로 가기를 부르지 않는다', async () => {
    // Given
    const { speechRecognizer, onEmpty, onFinished } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');

    // When
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    expect(onEmpty).not.toHaveBeenCalled();
  });

  test('초안을 지운 뒤 늦게 온 녹음 파일과 대기 쓰기가 초안을 되살리지 않는다', async () => {
    // Given
    const files = createLocalFileSystemFake();
    const uri = files.addFile(RECORDING_DIRECTORY, 'recording_a.wav');
    const { speechRecognizer, storage } = await renderRecording({ files });
    await start(speechRecognizer);
    await act(async () => speechRecognizer.emit({ type: 'recording-started', uri }));
    await say(speechRecognizer, '첫 문장.');

    // When
    await fireEvent.press(screen.getByTestId('discard'));
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));
    await act(async () => jest.advanceTimersByTime(2_000));

    // Then
    expect(storage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
  });

  test('이어 듣기를 눌러도 앞 구간의 end가 올 때까지 인식기를 다시 열지 않는다', async () => {
    // Given
    const { speechRecognizer } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('pause'));

    // When
    await fireEvent.press(screen.getByTestId('resume'));

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledTimes(1);

    // When
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
  });

  test('end가 끝내 오지 않아도 잠시 뒤 이어 듣는다', async () => {
    // Given
    const { speechRecognizer } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('pause'));
    await fireEvent.press(screen.getByTestId('resume'));

    // When
    await act(async () => jest.advanceTimersByTime(2_000));

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledTimes(2);
  });

  test('파일이 뒤바뀌어 와도 파일마다 그 구간의 시작 시각을 붙이고 시각 순서로 저장한다', async () => {
    // Given
    const files = createLocalFileSystemFake();
    const first = files.addFile(RECORDING_DIRECTORY, 'recording_a.wav');
    const second = files.addFile(RECORDING_DIRECTORY, 'recording_b.wav');
    const { speechRecognizer, storage, onFinished } = await renderRecording({ files });
    await fireEvent.press(screen.getByTestId('start'));
    await act(async () => speechRecognizer.emit({ type: 'recording-started', uri: first }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));
    await say(speechRecognizer, '첫 문장.');
    await act(async () => jest.advanceTimersByTime(5_000));
    await fireEvent.press(screen.getByTestId('pause'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await fireEvent.press(screen.getByTestId('resume'));
    await act(async () => speechRecognizer.emit({ type: 'recording-started', uri: second }));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri: second }));
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri: first }));
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    const draftId = screen.getByTestId('draft-id').props.children;
    const recordings = storage.drafts.find(ACCOUNT_ID, draftId)?.recordings ?? [];
    expect(recordings.map(({ fileName }) => fileName)).toEqual([
      `${draftId}-1.wav`,
      `${draftId}-0.wav`,
    ]);
    expect(recordings[0]?.startMs).toBe(0);
    expect(recordings[1]?.startMs).toBeGreaterThanOrEqual(5_000);
  });

  test('기다리는 시간을 넘긴 녹음 파일도 화면이 내려간 뒤 초안에 더한다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const files = createLocalFileSystemFake();
    const uri = files.addFile(RECORDING_DIRECTORY, 'recording_a.wav');
    const storage = createVoiceNoteStorageServiceFake(files);
    const onFinished = jest.fn();
    const { unmount } = await renderUi(
      <OverlayProvider>
        <RecordingProbe
          maxSeconds={null}
          onLimitReached={jest.fn()}
          onFinished={onFinished}
          onEmpty={jest.fn()}
        />
      </OverlayProvider>,
      {
        di: {
          speechRecognizer,
          voiceNoteStorageService: storage,
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      },
    );
    await start(speechRecognizer);
    await act(async () => speechRecognizer.emit({ type: 'recording-started', uri }));
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await act(async () => jest.advanceTimersByTime(3_100));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    const draftId = onFinished.mock.calls[0]?.[0];

    // When
    await act(async () => unmount());
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));

    // Then
    await waitFor(() =>
      expect(storage.drafts.find(ACCOUNT_ID, draftId)?.recordings).toHaveLength(1),
    );
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });

  describe('시작을 준비하는 사이 화면이 내려가거나 초안을 지우면', () => {
    const NO_MODEL = {
      isAvailable: true,
      canRecognizeOnDevice: false,
      canDownloadOnDeviceModel: true,
      canSaveRecording: true,
      canContinue: true,
    };

    const createDeferredCapabilities = () => {
      let resolve: (value: typeof NO_MODEL) => void = jest.fn();
      const promise = new Promise<typeof NO_MODEL>((onResolve) => {
        resolve = onResolve;
      });
      return { promise, resolve: (value: typeof NO_MODEL) => resolve(value) };
    };

    const renderStartingProbe = async () => {
      const speechRecognizer = createSpeechRecognizerStub();
      const capabilities = createDeferredCapabilities();
      speechRecognizer.getCapabilities.mockReturnValue(capabilities.promise);
      const probe = (
        <RecordingProbe
          maxSeconds={null}
          onLimitReached={jest.fn()}
          onFinished={jest.fn()}
          onEmpty={jest.fn()}
        />
      );
      const { rerender } = await renderUi(<OverlayProvider>{probe}</OverlayProvider>, {
        di: {
          speechRecognizer,
          voiceNoteStorageService: createVoiceNoteStorageServiceFake(),
          analytics: createMockAnalytics(),
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      });
      await fireEvent.press(screen.getByTestId('start'));
      return {
        speechRecognizer,
        capabilities,
        leaveScreen: () => rerender(<OverlayProvider>{null}</OverlayProvider>),
      };
    };

    test('화면이 내려갔으면 모델을 받을지 묻지 않고 인식기도 시작하지 않는다', async () => {
      // Given
      const { speechRecognizer, capabilities, leaveScreen } = await renderStartingProbe();
      await act(async () => leaveScreen());

      // When
      await act(async () => capabilities.resolve(NO_MODEL));

      // Then
      expect(screen.queryByText('나중에')).toBeNull();
      expect(speechRecognizer.start).not.toHaveBeenCalled();
    });

    test('모델이 있는 기기도 화면이 내려갔으면 인식기를 시작하지 않는다', async () => {
      // Given
      const { speechRecognizer, capabilities, leaveScreen } = await renderStartingProbe();
      await act(async () => leaveScreen());

      // When
      await act(async () => capabilities.resolve({ ...NO_MODEL, canDownloadOnDeviceModel: false }));

      // Then
      expect(speechRecognizer.start).not.toHaveBeenCalled();
    });

    test('닫아서 초안을 지웠으면 화면이 내려가기 전이어도 인식기를 시작하지 않는다', async () => {
      // Given
      const { speechRecognizer, capabilities } = await renderStartingProbe();
      await fireEvent.press(screen.getByTestId('discard'));

      // When
      await act(async () => capabilities.resolve({ ...NO_MODEL, canDownloadOnDeviceModel: false }));

      // Then
      expect(speechRecognizer.start).not.toHaveBeenCalled();
    });
  });

  test('끝내는 동안 화면이 내려가면 글자는 저장하되 결과 화면으로 끌어오지 않는다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const storage = createVoiceNoteStorageServiceFake();
    const onFinished = jest.fn();
    const { unmount } = await renderUi(
      <OverlayProvider>
        <RecordingProbe
          maxSeconds={null}
          onLimitReached={jest.fn()}
          onFinished={onFinished}
          onEmpty={jest.fn()}
        />
      </OverlayProvider>,
      {
        di: {
          speechRecognizer,
          voiceNoteStorageService: storage,
          analytics: createMockAnalytics(),
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      },
    );
    await start(speechRecognizer);
    await act(async () =>
      speechRecognizer.emit({ type: 'recording-started', uri: 'file:///recording_a.wav' }),
    );
    await say(speechRecognizer, '첫 문장.');
    const draftId = screen.getByTestId('draft-id').props.children;
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // When
    await act(async () => unmount());
    await act(async () => jest.advanceTimersByTimeAsync(3_100));

    // Then
    expect(onFinished).not.toHaveBeenCalled();
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.sentences).toHaveLength(1);
  });

  test('화면이 내려간 뒤 새 녹음의 파일이 와도 옛 초안으로 가져오지 않고 자기 파일만 받는다', async () => {
    // Given 앞 녹음의 파일을 기다리는 동안 새 녹음이 시작됐다
    const speechRecognizer = createSpeechRecognizerStub();
    const files = createLocalFileSystemFake();
    const uri = files.addFile(RECORDING_DIRECTORY, 'recording_a.wav');
    const newRecordingUri = files.addFile(RECORDING_DIRECTORY, 'recording_new.wav');
    const storage = createVoiceNoteStorageServiceFake(files);
    const onFinished = jest.fn();
    const { unmount } = await renderUi(
      <OverlayProvider>
        <RecordingProbe
          maxSeconds={null}
          onLimitReached={jest.fn()}
          onFinished={onFinished}
          onEmpty={jest.fn()}
        />
      </OverlayProvider>,
      {
        di: {
          speechRecognizer,
          voiceNoteStorageService: storage,
          analytics: createMockAnalytics(),
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      },
    );
    await start(speechRecognizer);
    await act(async () => speechRecognizer.emit({ type: 'recording-started', uri }));
    await say(speechRecognizer, '첫 문장.');
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    await act(async () => jest.advanceTimersByTime(3_100));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    const draftId = onFinished.mock.calls[0]?.[0];
    await act(async () => unmount());

    // When
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri: newRecordingUri }));

    // Then
    expect(files.hasFile(RECORDING_DIRECTORY, 'recording_new.wav')).toBe(true);
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.recordings).toEqual([]);
    expect(speechRecognizer.getListenerCount()).toBe(1);

    // When
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));

    // Then
    await waitFor(() =>
      expect(storage.drafts.find(ACCOUNT_ID, draftId)?.recordings).toHaveLength(1),
    );
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });

  describe('화면을 떠난 뒤 늦게 온 녹음 파일', () => {
    const renderListening = async () => {
      const speechRecognizer = createSpeechRecognizerStub();
      const files = createLocalFileSystemFake();
      const uri = files.addFile(RECORDING_DIRECTORY, 'recording_a.wav');
      const storage = createVoiceNoteStorageServiceFake(files);
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
            voiceNoteStorageService: storage,
            analytics: createMockAnalytics(),
            errorReporter: createErrorReporterStub(),
            haptics: createHapticsStub(),
            logger,
          },
        },
      );
      await start(speechRecognizer);
      await act(async () => speechRecognizer.emit({ type: 'recording-started', uri }));
      await say(speechRecognizer, '첫 문장.');
      const draftId = screen.getByTestId('draft-id').props.children;
      return { speechRecognizer, files, uri, storage, unmount, draftId };
    };

    test('지운 초안의 파일은 받는 즉시 지운다', async () => {
      // Given
      const { speechRecognizer, files, uri } = await renderListening();
      await fireEvent.press(screen.getByTestId('discard'));

      // When
      await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));

      // Then
      expect(files.hasFile(RECORDING_DIRECTORY, 'recording_a.wav')).toBe(false);
    });

    test('지우고 화면까지 내려간 뒤에 온 파일도 지우고 구독을 푼다', async () => {
      // Given
      const { speechRecognizer, files, uri, storage, unmount } = await renderListening();
      await fireEvent.press(screen.getByTestId('discard'));
      await act(async () => unmount());

      // When
      await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));

      // Then
      expect(files.hasFile(RECORDING_DIRECTORY, 'recording_a.wav')).toBe(false);
      expect(storage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
      expect(speechRecognizer.getListenerCount()).toBe(0);
    });

    test('끝내지 않고 떠났어도 초안이 남아 있으면 파일을 그 초안에 더한다', async () => {
      // Given 스와이프로 나가 듣던 세션이 끊겼다
      const { speechRecognizer, uri, storage, unmount, draftId } = await renderListening();
      await act(async () => unmount());

      // When
      await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));
      await act(async () => jest.advanceTimersByTimeAsync(2_000));

      // Then
      expect(storage.drafts.find(ACCOUNT_ID, draftId)?.recordings).toHaveLength(1);
      expect(speechRecognizer.getListenerCount()).toBe(0);
    });

    test('파일이 끝내 오지 않으면 30초 뒤 구독을 푼다', async () => {
      // Given
      const { speechRecognizer, unmount } = await renderListening();
      await act(async () => unmount());

      // When
      await act(async () => jest.advanceTimersByTime(30_100));

      // Then
      expect(speechRecognizer.getListenerCount()).toBe(0);
    });
  });

  test('인식기가 실패하면 듣던 글자까지 초안에 바로 저장한다', async () => {
    // Given
    const { speechRecognizer, storage } = await renderRecording();
    await start(speechRecognizer);
    await say(speechRecognizer, '실패 전에 한 말', false);

    // When
    await act(async () => speechRecognizer.emit({ type: 'error', code: 'audio-capture' }));

    // Then
    const draftId = screen.getByTestId('draft-id').props.children;
    expect(screen.getByTestId('status')).toHaveTextContent('failed');
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.sentences.map(({ text }) => text)).toEqual([
      '실패 전에 한 말',
    ]);
  });

  test('화면이 내려간 뒤에도 기다리던 초안 쓰기가 끝나 글자가 남는다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const storage = createVoiceNoteStorageServiceFake();
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
          voiceNoteStorageService: storage,
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      },
    );
    await start(speechRecognizer);
    await say(speechRecognizer, '앱을 떠나기 전 말.');
    const draftId = screen.getByTestId('draft-id').props.children;
    expect(storage.drafts.find(ACCOUNT_ID, draftId)).toBeUndefined();

    // When
    await act(async () => unmount());
    await act(async () => jest.advanceTimersByTime(2_000));

    // Then
    expect(storage.drafts.find(ACCOUNT_ID, draftId)?.sentences).toHaveLength(1);
  });

  test('앱을 다시 열어 저장된 초안으로 들어오면 글자를 보여 주고 시간 뒤로 이어 쓴다', async () => {
    // Given 앞 세션이 저장한 초안이 기기에 있다
    const speechRecognizer = createSpeechRecognizerStub();
    const storage = createVoiceNoteStorageServiceFake();
    storage.drafts.save(
      ACCOUNT_ID,
      createVoiceNoteFixture({
        draftId: 'restored-1',
        durationMs: 40_000,
        recordings: [],
        sentences: [createVoiceNoteSentence({ text: '복원된 말.', startMs: 0, endMs: 40_000 })],
      }),
    );

    // When
    await renderUi(
      <OverlayProvider>
        <RecordingProbe
          seedDraftId="restored-1"
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
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          haptics: createHapticsStub(),
          logger,
        },
      },
    );

    // Then
    expect(screen.getByTestId('captions')).toHaveTextContent('복원된 말.');

    // When
    await start(speechRecognizer);
    await say(speechRecognizer, '이어 한 말.');
    await act(async () => jest.advanceTimersByTime(2_000));

    // Then
    const saved = storage.drafts.find(ACCOUNT_ID, 'restored-1');
    expect(saved?.sentences.map(({ text }) => text)).toEqual(['복원된 말.', '이어 한 말.']);
    expect(saved?.sentences[1]?.startMs).toBeGreaterThanOrEqual(40_000);
  });

  test('저장 공간이 모자라 파일을 옮기지 못해도 글자는 넘기고 조각만 빠진다', async () => {
    // Given
    const files = createLocalFileSystemFake();
    const uri = files.addFile(RECORDING_DIRECTORY, 'recording_a.wav');
    const { speechRecognizer, storage, onFinished } = await renderRecording({ files });
    await start(speechRecognizer);
    await act(async () => speechRecognizer.emit({ type: 'recording-started', uri }));
    await say(speechRecognizer, '첫 문장.');
    files.failNextMove(new Error('no space left'));

    // When
    await fireEvent.press(screen.getByTestId('finish'));
    await act(async () => speechRecognizer.emit({ type: 'recording-saved', uri }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    const draftId = screen.getByTestId('draft-id').props.children;
    const saved = storage.drafts.find(ACCOUNT_ID, draftId);
    expect(saved?.sentences).toHaveLength(1);
    expect(saved?.recordings).toEqual([]);
  });

  test('녹음 폴더를 만들지 못하면 파일 없이 글자만 받으며 듣는다', async () => {
    // Given
    const files = createLocalFileSystemFake();
    const { speechRecognizer } = await renderRecording({ files });
    files.failNextEnsureDirectory(new Error('no space left'));

    // When
    await start(speechRecognizer);

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledWith(
      expect.objectContaining({ recordingDirectory: null }),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('listening');
  });
});
