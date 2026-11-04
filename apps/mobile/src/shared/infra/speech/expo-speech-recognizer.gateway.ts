import type {
  OfflineModelResult,
  PermissionSnapshot,
  SpeechEvent,
  SpeechLocale,
  SpeechMode,
  SpeechRecognizer,
  SpeechStartOptions,
} from '@src/core/ports/speech-recognizer';
import { clamp } from 'es-toolkit';
import {
  type ExpoSpeechRecognitionOptions,
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';
import { match } from 'ts-pattern';

/** 연속 인식·녹음 저장이 들어온 Android 13 */
const ANDROID_CONTINUOUS_API_LEVEL = 33;
/** SDK가 주는 음량 범위. 0 이하는 들리지 않는 소리다 */
const VOLUME_RANGE = { min: -2, max: 10 } as const;
const VOLUME_INTERVAL_MS = 50;
/** 긴 녹음은 생각하며 말하므로 Android 기본(약 2초)보다 오래 기다려야 말 사이 침묵에 끊기지 않는다 */
const NOTE_COMPLETE_SILENCE_MS = 10_000;
/** 16kHz 16bit mono WAV(약 1.9MB/분). Android는 이 형식으로만 저장한다 */
const RECORDING_SAMPLE_RATE = 16_000;

function toPermissionSnapshot({
  granted,
  canAskAgain,
}: {
  granted: boolean;
  canAskAgain: boolean;
}): PermissionSnapshot {
  return { isGranted: granted, canAskAgain };
}

/** iOS 기기 안 인식은 음성이 Apple 서버로 가지 않아 마이크 권한만 있으면 된다 */
function usesMicrophoneOnlyPermission(mode: SpeechMode) {
  return (
    mode === 'note' &&
    Platform.OS === 'ios' &&
    ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()
  );
}

function supportsContinuousRecognition() {
  return (
    Platform.OS !== 'android' ||
    (typeof Platform.Version === 'number' && Platform.Version >= ANDROID_CONTINUOUS_API_LEVEL)
  );
}

async function getInstalledOnDeviceLocales() {
  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    return installedLocales;
  } catch {
    // Android 12 이하나 인식 서비스가 없는 기기는 목록을 주지 못한다. 기기 안 인식을 쓰지 않는다
    return [];
  }
}

function normalizeVolume(value: number) {
  return clamp((value - VOLUME_RANGE.min) / (VOLUME_RANGE.max - VOLUME_RANGE.min), 0, 1);
}

function toRecognitionOptions({
  locale,
  mode,
  contextualStrings,
  isOnDevice,
  recordingDirectory,
}: SpeechStartOptions): ExpoSpeechRecognitionOptions {
  const common: ExpoSpeechRecognitionOptions = {
    lang: locale,
    interimResults: true,
    maxAlternatives: 1,
    requiresOnDeviceRecognition: isOnDevice,
    ...(contextualStrings.length > 0 && { contextualStrings: [...contextualStrings] }),
  };
  const volumeChangeEventOptions = { enabled: true, intervalMillis: VOLUME_INTERVAL_MS };

  return match(mode)
    .returnType<ExpoSpeechRecognitionOptions>()
    .with('dictation', () => ({ ...common, continuous: false, iosTaskHint: 'dictation' }))
    .with('quick', () => ({
      ...common,
      continuous: true,
      iosTaskHint: 'dictation',
      volumeChangeEventOptions,
    }))
    .with('note', () => ({
      ...common,
      continuous: true,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: NOTE_COMPLETE_SILENCE_MS,
        EXTRA_MASK_OFFENSIVE_WORDS: false,
      },
      volumeChangeEventOptions,
      ...(recordingDirectory != null &&
        ExpoSpeechRecognitionModule.supportsRecording() && {
          recordingOptions: {
            persist: true,
            outputDirectory: recordingDirectory,
            outputSampleRate: RECORDING_SAMPLE_RATE,
            outputEncoding: 'pcmFormatInt16',
          },
        }),
    }))
    .exhaustive();
}

export const expoSpeechRecognizerGateway: SpeechRecognizer = {
  getPermission: async (mode) =>
    toPermissionSnapshot(
      usesMicrophoneOnlyPermission(mode)
        ? await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync()
        : await ExpoSpeechRecognitionModule.getPermissionsAsync(),
    ),

  requestPermission: async (mode) =>
    toPermissionSnapshot(
      usesMicrophoneOnlyPermission(mode)
        ? await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()
        : await ExpoSpeechRecognitionModule.requestPermissionsAsync(),
    ),

  getCapabilities: async (locale) => {
    const supportsOnDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    const canRecognizeOnDevice =
      supportsOnDevice &&
      (Platform.OS !== 'android' || (await getInstalledOnDeviceLocales()).includes(locale));

    return {
      isAvailable: ExpoSpeechRecognitionModule.isRecognitionAvailable(),
      canRecognizeOnDevice,
      canSaveRecording: ExpoSpeechRecognitionModule.supportsRecording(),
      canContinue: supportsContinuousRecognition(),
    };
  },

  requestOfflineModel: async (locale: SpeechLocale): Promise<OfflineModelResult> => {
    if (Platform.OS !== 'android') {
      return 'unavailable';
    }
    try {
      const { status } = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
        locale,
      });
      return match(status)
        .returnType<OfflineModelResult>()
        .with('download_success', () => 'downloaded')
        .with('download_scheduled', () => 'scheduled')
        .with('opened_dialog', () => 'dialog-opened')
        .exhaustive();
    } catch {
      // 인식 서비스가 이 언어 모델을 내려받지 못한다. 네트워크 인식으로 이어 간다
      return 'unavailable';
    }
  },

  start: (options) => {
    ExpoSpeechRecognitionModule.start(toRecognitionOptions(options));
  },

  stop: () => {
    ExpoSpeechRecognitionModule.stop();
  },

  abort: () => {
    ExpoSpeechRecognitionModule.abort();
  },

  subscribe: (listener: (event: SpeechEvent) => void) => {
    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener('start', () => listener({ type: 'start' })),
      ExpoSpeechRecognitionModule.addListener('end', () => listener({ type: 'end' })),
      ExpoSpeechRecognitionModule.addListener('result', ({ isFinal, results }) => {
        const [best] = results;
        if (best == null) {
          return;
        }
        listener({
          type: 'result',
          transcript: best.transcript,
          isFinal,
          segments: best.segments.map((segment) => ({
            text: segment.segment,
            startMs: segment.startTimeMillis,
            endMs: segment.endTimeMillis,
            confidence: segment.confidence,
          })),
        });
      }),
      ExpoSpeechRecognitionModule.addListener('volumechange', ({ value }) =>
        listener({ type: 'volume', level: normalizeVolume(value) }),
      ),
      ExpoSpeechRecognitionModule.addListener('audioend', ({ uri }) => {
        if (uri != null) {
          listener({ type: 'recording-saved', uri });
        }
      }),
      ExpoSpeechRecognitionModule.addListener('error', ({ error }) =>
        listener({ type: 'error', code: error }),
      ),
    ];

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  },
};
