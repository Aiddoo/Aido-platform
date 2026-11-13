import type {
  MissingSpeechPermission,
  OfflineModelResult,
  SpeechPermission,
  SpeechEvent,
  SpeechLocale,
  SpeechMode,
  SpeechRecognizer,
  SpeechStartOptions,
} from '@src/core/ports/speech-recognizer';
import { ANDROID_API_LEVEL } from '@src/shared/infra/device/device-info';
import { clamp } from 'es-toolkit';
import { type PermissionResponse, PermissionStatus } from 'expo';
import { getLocales } from 'expo-localization';
import {
  type ExpoSpeechRecognitionOptions,
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';
import { match } from 'ts-pattern';

/** Apple 권장 상한. 한 항목은 한두 단어로 둔다(SFSpeechRecognitionRequest.contextualStrings) */
const MAX_SPEECH_HINTS = 100;
/** 연속 인식·녹음 저장이 들어온 Android 13 */
const ANDROID_CONTINUOUS_API_LEVEL = 33;
/** SDK가 주는 음량 범위. 0 이하는 들리지 않는 소리다 */
const VOLUME_RANGE = { min: -2, max: 10 } as const;
const VOLUME_INTERVAL_MS = 50;
/** 16kHz 16bit mono WAV(약 1.9MB/분). Android는 이 형식으로만 저장한다 */
const RECORDING_SAMPLE_RATE = 16_000;

/** 합친 응답은 어느 쪽이 거절됐는지 알려주지 않아 따로 읽는다. Android의 음성 인식은 늘 허용으로 온다 */
async function findMissingSpeechPermission(): Promise<MissingSpeechPermission> {
  const [microphone, speechRecognizer] = await Promise.all([
    ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync(),
    ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync(),
  ]);

  if (speechRecognizer.status !== PermissionStatus.DENIED) {
    return 'microphone';
  }
  return microphone.status === PermissionStatus.DENIED ? 'both' : 'speech-recognition';
}

async function toSpeechPermission(
  { status, canAskAgain }: PermissionResponse,
  { isMicrophoneOnly }: { isMicrophoneOnly: boolean },
): Promise<SpeechPermission> {
  if (status === PermissionStatus.GRANTED) {
    return { status, canAskAgain };
  }
  return {
    status,
    canAskAgain,
    missing: isMicrophoneOnly ? 'microphone' : await findMissingSpeechPermission(),
  };
}

function supportsContinuousRecognition() {
  return (
    process.env.EXPO_OS !== 'android' ||
    (ANDROID_API_LEVEL != null && ANDROID_API_LEVEL >= ANDROID_CONTINUOUS_API_LEVEL)
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

/** iOS SDK의 `supportsOnDeviceRecognition`은 기기 기본 언어만 보고 `installedLocales`는 지원 전체라 다른 언어는 알 수 없다. 기기 인식으로 시작하면 SDK가 조용히 네트워크로 넘어가 권한 오류(1700)가 나므로 확인되지 않은 언어는 네트워크 인식으로 본다 */
async function canRecognizeOnDevice(locale: SpeechLocale) {
  if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
    return false;
  }
  if (!(await getInstalledOnDeviceLocales()).includes(locale)) {
    return false;
  }
  return process.env.EXPO_OS !== 'ios' || getLocales()[0]?.languageTag === locale;
}

/** iOS 한국어는 서버 인식이 더 정확해(2026-11 실기기 비교) 짧은 말은 서버로 보낸다. 긴 녹음은 끊기지 않게 기기 인식을 우선한다 */
async function shouldRecognizeOnDevice(mode: SpeechMode, locale: SpeechLocale) {
  if (process.env.EXPO_OS === 'ios' && mode !== 'note') {
    return false;
  }
  return canRecognizeOnDevice(locale);
}

/** iOS 기기 안 인식은 음성이 Apple 서버로 가지 않아 마이크 권한만 있으면 된다 */
async function usesMicrophoneOnlyPermission(mode: SpeechMode, locale: SpeechLocale) {
  return process.env.EXPO_OS === 'ios' && (await shouldRecognizeOnDevice(mode, locale));
}

function normalizeVolume(value: number) {
  return clamp((value - VOLUME_RANGE.min) / (VOLUME_RANGE.max - VOLUME_RANGE.min), 0, 1);
}

function toRecognitionOptions({
  locale,
  mode,
  hintWords,
  isOnDevice,
  recordingDirectory,
}: SpeechStartOptions): ExpoSpeechRecognitionOptions {
  const common: ExpoSpeechRecognitionOptions = {
    lang: locale,
    interimResults: true,
    maxAlternatives: 1,
    requiresOnDeviceRecognition: isOnDevice,
    contextualStrings: hintWords.slice(0, MAX_SPEECH_HINTS),
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
      // 침묵 길이는 넘기지 않는다. continuous면 SDK가 Android 13+은 오디오 소스가 닫힐 때까지 듣는 세션을,
      // 12 이하는 10분 침묵을 잡는다. 공식 문서상 이 값은 세션을 끝내는 침묵이라 넘기면 오히려 짧아진다
      androidIntentOptions: { EXTRA_MASK_OFFENSIVE_WORDS: false },
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

export const expoSpeechRecognizer: SpeechRecognizer = {
  getPermission: async (mode, locale) => {
    const isMicrophoneOnly = await usesMicrophoneOnlyPermission(mode, locale);

    return toSpeechPermission(
      isMicrophoneOnly
        ? await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync()
        : await ExpoSpeechRecognitionModule.getPermissionsAsync(),
      { isMicrophoneOnly },
    );
  },

  requestPermission: async (mode, locale) => {
    const isMicrophoneOnly = await usesMicrophoneOnlyPermission(mode, locale);

    return toSpeechPermission(
      isMicrophoneOnly
        ? await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()
        : await ExpoSpeechRecognitionModule.requestPermissionsAsync(),
      { isMicrophoneOnly },
    );
  },

  getCapabilities: async (mode, locale) => {
    const isOnDevice = await shouldRecognizeOnDevice(mode, locale);

    return {
      isAvailable: ExpoSpeechRecognitionModule.isRecognitionAvailable(),
      canRecognizeOnDevice: isOnDevice,
      canDownloadOnDeviceModel:
        process.env.EXPO_OS === 'android' &&
        ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() &&
        !isOnDevice,
      canSaveRecording: ExpoSpeechRecognitionModule.supportsRecording(),
      canContinue: supportsContinuousRecognition(),
    };
  },

  requestOfflineModel: async (locale: SpeechLocale): Promise<OfflineModelResult> => {
    if (process.env.EXPO_OS !== 'android') {
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
      ExpoSpeechRecognitionModule.addListener('nomatch', () => listener({ type: 'no-match' })),
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
      ExpoSpeechRecognitionModule.addListener('audiostart', ({ uri }) => {
        if (uri != null) {
          listener({ type: 'recording-started', uri });
        }
      }),
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
