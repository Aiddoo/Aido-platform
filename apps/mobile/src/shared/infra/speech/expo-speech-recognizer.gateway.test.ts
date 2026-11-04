import type { SpeechEvent, SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { expoSpeechRecognizerGateway } from './expo-speech-recognizer.gateway';

type NativeListener = (event: unknown) => void;

const mockNativeListeners = new Map<string, NativeListener>();
const mockRemove = jest.fn();

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: jest.fn(),
    supportsRecording: jest.fn(() => true),
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

function emitNative(eventName: string, event: unknown) {
  mockNativeListeners.get(eventName)?.(event);
}

describe('expoSpeechRecognizerGateway', () => {
  afterEach(() => {
    mockNativeListeners.clear();
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
});
