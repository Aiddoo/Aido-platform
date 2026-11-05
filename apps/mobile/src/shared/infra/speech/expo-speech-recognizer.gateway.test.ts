import type { SpeechEvent, SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { PermissionStatus, type PermissionResponse } from 'expo';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';

import { expoSpeechRecognizerGateway } from './expo-speech-recognizer.gateway';

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
  contextualStrings: [],
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

describe('expoSpeechRecognizerGateway', () => {
  afterEach(() => {
    mockNativeListeners.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('받아쓰기는 지금처럼 한 번 말하면 끝나고 음량·녹음 옵션을 켜지 않는다', () => {
    // When
    expoSpeechRecognizerGateway.start(START_OPTIONS);

    // Then
    const [options] = nativeModule.start.mock.calls[0] ?? [];
    expect(options).toEqual({
      lang: 'ko-KR',
      interimResults: true,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: false,
      continuous: false,
      iosTaskHint: 'dictation',
    });
  });

  test('긴 녹음은 기기 안에서 이어 듣고 문장부호·고유명사·16kHz 녹음 파일을 쓴다', () => {
    // When
    expoSpeechRecognizerGateway.start({
      ...START_OPTIONS,
      mode: 'note',
      contextualStrings: ['기획팀', '민지'],
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
        androidIntentOptions: expect.objectContaining({ EXTRA_MASK_OFFENSIVE_WORDS: false }),
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

  test('음량은 SDK 범위(-2..10)를 0..1로 바꾸고 범위 밖 값은 자른다', () => {
    // Given
    const events: SpeechEvent[] = [];
    expoSpeechRecognizerGateway.subscribe((event) => events.push(event));

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

  test('결과는 가장 그럴듯한 문장과 단어 구간을 앱 모양으로 넘긴다', () => {
    // Given
    const events: SpeechEvent[] = [];
    expoSpeechRecognizerGateway.subscribe((event) => events.push(event));

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

  test('구독을 끝내면 붙인 네이티브 리스너를 모두 뗀다', () => {
    // Given
    const unsubscribe = expoSpeechRecognizerGateway.subscribe(jest.fn());
    const attachedCount = nativeModule.addListener.mock.calls.length;

    // When
    unsubscribe();

    // Then
    expect(mockRemove).toHaveBeenCalledTimes(attachedCount);
  });

  test('네트워크 인식이면 내 카테고리·할 일 이름을 인식 서비스로 보내지 않는다', () => {
    // When
    expoSpeechRecognizerGateway.start({
      ...START_OPTIONS,
      mode: 'quick',
      contextualStrings: ['기획팀'],
      isOnDevice: false,
    });

    // Then
    const [options] = nativeModule.start.mock.calls.at(-1) ?? [];
    expect(options?.contextualStrings).toBeUndefined();
    expect(options?.requiresOnDeviceRecognition).toBe(false);
  });

  test('녹음 파일을 쓰기 시작하면 파일 주소를 알린다', () => {
    // Given
    const events: SpeechEvent[] = [];
    expoSpeechRecognizerGateway.subscribe((event) => events.push(event));

    // When
    emitNative('audiostart', { uri: 'file:///recording_a.wav', timestamp: 1 });
    emitNative('audiostart', { uri: null, timestamp: 2 });

    // Then
    expect(events).toEqual([{ type: 'recording-started', uri: 'file:///recording_a.wav' }]);
  });

  describe('iOS 언어별 기능 확인', () => {
    test('기기 기본 언어는 기기 인식으로 보고 마이크 권한만 묻는다', async () => {
      // When
      const capabilities = await expoSpeechRecognizerGateway.getCapabilities('ko-KR');
      await expoSpeechRecognizerGateway.requestPermission('note', 'ko-KR');

      // Then
      expect(capabilities.canRecognizeOnDevice).toBe(true);
      expect(nativeModule.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
      expect(nativeModule.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    test('기기 기본 언어가 아니면 네트워크 인식으로 보고 음성 인식 권한까지 묻는다', async () => {
      // When
      const capabilities = await expoSpeechRecognizerGateway.getCapabilities('en-US');
      await expoSpeechRecognizerGateway.requestPermission('note', 'en-US');

      // Then
      expect(capabilities.canRecognizeOnDevice).toBe(false);
      expect(capabilities.canDownloadOnDeviceModel).toBe(false);
      expect(nativeModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(nativeModule.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    });

    test('받아쓰기는 언어와 상관없이 음성 인식 권한까지 묻는다', async () => {
      // When
      await expoSpeechRecognizerGateway.getPermission('dictation', 'ko-KR');

      // Then
      expect(nativeModule.getPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    test.each([
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
        const permission = await expoSpeechRecognizerGateway.getPermission('dictation', 'ko-KR');

        // Then
        expect(permission).toEqual({ isGranted: false, canAskAgain: false, missing });
      },
    );

    test('기기 인식이면 음성 인식 권한을 읽지 않고 마이크를 막은 권한으로 알린다', async () => {
      // Given
      nativeModule.getMicrophonePermissionsAsync.mockResolvedValueOnce(
        createPermissionResponse({ status: PermissionStatus.DENIED }),
      );

      // When
      const permission = await expoSpeechRecognizerGateway.getPermission('note', 'ko-KR');

      // Then
      expect(permission).toEqual({ isGranted: false, canAskAgain: false, missing: 'microphone' });
      expect(nativeModule.getSpeechRecognizerPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  test('Android는 설치된 언어 모델로 기기 인식을 판단하고 없으면 받기를 제안한다', async () => {
    // Given
    jest.replaceProperty(Platform, 'OS', 'android');
    nativeModule.getSupportedLocales.mockResolvedValueOnce({
      locales: ['ko-KR', 'en-US'],
      installedLocales: ['en-US'],
    });

    // When
    const capabilities = await expoSpeechRecognizerGateway.getCapabilities('ko-KR');

    // Then
    expect(capabilities.canRecognizeOnDevice).toBe(false);
    expect(capabilities.canDownloadOnDeviceModel).toBe(true);
  });
});
