import type { SpeechEvent, SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { range } from 'es-toolkit';
import { PermissionStatus, type PermissionResponse } from 'expo';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { expoSpeechRecognizer } from './expo-speech-recognizer';

type NativeListener = (event: unknown) => void;

const mockNativeListeners = new Map<string, NativeListener>();
const mockRemove = jest.fn();

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: jest.fn(),
    supportsRecording: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => true),
    isRecognitionAvailable: jest.fn(() => true),
    getSupportedLocales: jest.fn(() =>
      Promise.resolve({ locales: ['ko-KR', 'en-US'], installedLocales: ['ko-KR', 'en-US'] }),
    ),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
    getMicrophonePermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true }),
    ),
    getSpeechRecognizerPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true }),
    ),
    requestMicrophonePermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true }),
    ),
    addListener: jest.fn((eventName: string, listener: NativeListener) => {
      mockNativeListeners.set(eventName, listener);
      return { remove: mockRemove };
    }),
  },
}));

const nativeModule = jest.mocked(ExpoSpeechRecognitionModule);

const START_OPTIONS: SpeechStartOptions = {
  locale: 'ko-KR',
  mode: 'dictation',
  hintWords: [],
  isOnDevice: false,
  recordingDirectory: null,
};

function createPermissionResponse(
  response: Partial<PermissionResponse> & Pick<PermissionResponse, 'status'>,
) {
  return {
    granted: response.status === 'granted',
    canAskAgain: response.status !== PermissionStatus.DENIED,
    expires: 'never' as const,
    ...response,
  };
}

function emitNative(eventName: string, event: unknown) {
  mockNativeListeners.get(eventName)?.(event);
}

describe('expoSpeechRecognizer', () => {
  afterEach(() => {
    mockNativeListeners.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('받아쓰기는 지금처럼 한 번 말하면 끝나고 음량·녹음 옵션을 켜지 않는다', () => {
    // When
    expoSpeechRecognizer.start(START_OPTIONS);

    // Then
    const [options] = nativeModule.start.mock.calls[0] ?? [];
    expect(options).toEqual({
      lang: 'ko-KR',
      interimResults: true,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: false,
      contextualStrings: [],
      continuous: false,
      iosTaskHint: 'dictation',
    });
  });

  it('힌트가 많아도 Apple 권장 상한 100개까지만 넘긴다', () => {
    // Given
    const hintWords = range(150).map((index) => `단어${index}`);

    // When
    expoSpeechRecognizer.start({ ...START_OPTIONS, hintWords });

    // Then
    expect(nativeModule.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ contextualStrings: hintWords.slice(0, 100) }),
    );
  });

  it('긴 녹음은 기기 안에서 이어 듣고 문장부호·고유명사·16kHz 녹음 파일을 쓴다', () => {
    // When
    expoSpeechRecognizer.start({
      ...START_OPTIONS,
      mode: 'note',
      hintWords: ['기획팀', '민지'],
      isOnDevice: true,
      recordingDirectory: 'file:///documents/voice-notes',
    });

    // Then
    expect(nativeModule.start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
        contextualStrings: ['기획팀', '민지'],
        iosTaskHint: 'dictation',
        // 침묵 길이는 SDK의 continuous에 맡긴다. 넘기면 12 이하의 10분 침묵을 덮어 세션이 짧아진다
        androidIntentOptions: { EXTRA_MASK_OFFENSIVE_WORDS: false },
        volumeChangeEventOptions: { enabled: true, intervalMillis: 50 },
        recordingOptions: {
          persist: true,
          outputDirectory: 'file:///documents/voice-notes',
          outputSampleRate: 16_000,
          outputEncoding: 'pcmFormatInt16',
        },
      }),
    );
  });

  it('글자 없이 닫힌 구간은 세션 끝과 나눠 알린다', () => {
    // Given
    const events: SpeechEvent[] = [];
    expoSpeechRecognizer.subscribe((event) => events.push(event));

    // When
    emitNative('nomatch', {});

    // Then
    expect(events).toEqual([{ type: 'no-match' }]);
  });

  it('음량은 SDK 범위(-2..10)를 0..1로 바꾸고 범위 밖 값은 자른다', () => {
    // Given
    const events: SpeechEvent[] = [];
    expoSpeechRecognizer.subscribe((event) => events.push(event));

    // When
    for (const value of [-2, 4, 10, 15]) {
      emitNative('volumechange', { value });
    }

    // Then
    expect(events).toEqual([
      { type: 'volume', level: 0 },
      { type: 'volume', level: 0.5 },
      { type: 'volume', level: 1 },
      { type: 'volume', level: 1 },
    ]);
  });

  it('결과는 가장 그럴듯한 문장과 단어 구간을 앱 모양으로 넘긴다', () => {
    // Given
    const events: SpeechEvent[] = [];
    expoSpeechRecognizer.subscribe((event) => events.push(event));

    // When
    emitNative('result', {
      isFinal: true,
      results: [
        {
          transcript: '내일 회의',
          confidence: 0.9,
          segments: [{ startTimeMillis: 0, endTimeMillis: 400, segment: '내일', confidence: 0.8 }],
        },
      ],
    });

    // Then
    expect(events).toEqual([
      {
        type: 'result',
        transcript: '내일 회의',
        isFinal: true,
        segments: [{ text: '내일', startMs: 0, endMs: 400, confidence: 0.8 }],
      },
    ]);
  });

  it('구독을 끝내면 붙인 네이티브 리스너를 모두 뗀다', () => {
    // Given
    const unsubscribe = expoSpeechRecognizer.subscribe(jest.fn());
    const attachedCount = nativeModule.addListener.mock.calls.length;

    // When
    unsubscribe();

    // Then
    expect(mockRemove).toHaveBeenCalledTimes(attachedCount);
  });

  it('녹음 파일을 쓰기 시작하면 파일 주소를 알린다', () => {
    // Given
    const events: SpeechEvent[] = [];
    expoSpeechRecognizer.subscribe((event) => events.push(event));

    // When
    emitNative('audiostart', { uri: 'file:///recording_a.wav', timestamp: 1 });
    emitNative('audiostart', { uri: null, timestamp: 2 });

    // Then
    expect(events).toEqual([{ type: 'recording-started', uri: 'file:///recording_a.wav' }]);
  });

  describe('iOS 언어별 기능 확인', () => {
    it('기기 기본 언어는 기기 인식으로 보고 마이크 권한만 묻는다', async () => {
      // When
      const capabilities = await expoSpeechRecognizer.getCapabilities('note', 'ko-KR');
      await expoSpeechRecognizer.requestPermission('note', 'ko-KR');

      // Then
      expect(capabilities.canRecognizeOnDevice).toBe(true);
      expect(nativeModule.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
      expect(nativeModule.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('빠른 말하기는 기기 기본 언어여도 서버 인식으로 보고 음성 인식 권한까지 묻는다', async () => {
      // When
      const capabilities = await expoSpeechRecognizer.getCapabilities('quick', 'ko-KR');
      await expoSpeechRecognizer.requestPermission('quick', 'ko-KR');

      // Then
      expect(capabilities.canRecognizeOnDevice).toBe(false);
      expect(nativeModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(nativeModule.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    });

    it('기기 기본 언어가 아니면 네트워크 인식으로 보고 음성 인식 권한까지 묻는다', async () => {
      // When
      const capabilities = await expoSpeechRecognizer.getCapabilities('note', 'en-US');
      await expoSpeechRecognizer.requestPermission('note', 'en-US');

      // Then
      expect(capabilities.canRecognizeOnDevice).toBe(false);
      expect(capabilities.canDownloadOnDeviceModel).toBe(false);
      expect(nativeModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(nativeModule.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    });

    it('받아쓰기는 언어와 상관없이 음성 인식 권한까지 묻는다', async () => {
      // When
      await expoSpeechRecognizer.getPermission('dictation', 'ko-KR');

      // Then
      expect(nativeModule.getPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        microphone: PermissionStatus.GRANTED,
        speechRecognizer: PermissionStatus.DENIED,
        missing: 'speech-recognition',
      },
      {
        microphone: PermissionStatus.DENIED,
        speechRecognizer: PermissionStatus.GRANTED,
        missing: 'microphone',
      },
      {
        microphone: PermissionStatus.DENIED,
        speechRecognizer: PermissionStatus.DENIED,
        missing: 'both',
      },
      {
        microphone: PermissionStatus.DENIED,
        speechRecognizer: PermissionStatus.UNDETERMINED,
        missing: 'microphone',
      },
    ])(
      '마이크 $microphone·음성 인식 $speechRecognizer이면 $missing을 막은 권한으로 알린다',
      async ({ microphone, speechRecognizer, missing }) => {
        // Given
        nativeModule.getPermissionsAsync.mockResolvedValueOnce(
          createPermissionResponse({ status: PermissionStatus.DENIED }),
        );
        nativeModule.getMicrophonePermissionsAsync.mockResolvedValueOnce(
          createPermissionResponse({ status: microphone }),
        );
        nativeModule.getSpeechRecognizerPermissionsAsync.mockResolvedValueOnce(
          createPermissionResponse({ status: speechRecognizer }),
        );

        // When
        const permission = await expoSpeechRecognizer.getPermission('dictation', 'ko-KR');

        // Then
        expect(permission).toEqual({ status: 'denied', canAskAgain: false, missing });
      },
    );

    it('기기 인식이면 음성 인식 권한을 읽지 않고 마이크를 막은 권한으로 알린다', async () => {
      // Given
      nativeModule.getMicrophonePermissionsAsync.mockResolvedValueOnce(
        createPermissionResponse({ status: PermissionStatus.DENIED }),
      );

      // When
      const permission = await expoSpeechRecognizer.getPermission('note', 'ko-KR');

      // Then
      expect(permission).toEqual({ status: 'denied', canAskAgain: false, missing: 'microphone' });
      expect(nativeModule.getSpeechRecognizerPermissionsAsync).not.toHaveBeenCalled();
    });
  });
});
