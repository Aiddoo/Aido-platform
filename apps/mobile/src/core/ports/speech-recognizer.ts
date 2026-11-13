import type { OsPermission, OsPermissionStatus } from './os-permission';

export const SPEECH_LOCALES = ['ko-KR', 'en-US'] as const;
export type SpeechLocale = (typeof SPEECH_LOCALES)[number];

/**
 * - `dictation`: 한 번 말하면 끝나는 받아쓰기(할 일·하위 할 일 입력)
 * - `quick`: 이어서 말하는 빠른 말하기
 * - `note`: 긴 녹음. 기기 안 인식·문장부호·녹음 파일 저장을 쓴다
 */
export type SpeechMode = 'dictation' | 'quick' | 'note';

export const SPEECH_ERROR_CODES = [
  'aborted',
  'audio-capture',
  'interrupted',
  'bad-grammar',
  'language-not-supported',
  'network',
  'no-speech',
  'not-allowed',
  'service-not-allowed',
  'busy',
  'client',
  'speech-timeout',
  'too-many-requests',
  'unknown',
] as const;

export type SpeechErrorCode = (typeof SPEECH_ERROR_CODES)[number];

/** 인식기가 준 단어 구간. iOS·Android 14+ 기기 안 인식에서만 온다 */
export interface SpeechSegment {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export type SpeechEvent =
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'result'; transcript: string; isFinal: boolean; segments: readonly SpeechSegment[] }
  /** 인식기가 한 구간을 글자 없이 닫았다. 세션은 끝나지 않고 이어진다 */
  | { type: 'no-match' }
  /** 0(조용함)..1(큼) */
  | { type: 'volume'; level: number }
  /** 이 구간의 녹음 파일을 쓰기 시작했다. 같은 `uri`로 `recording-saved`가 온다 */
  | { type: 'recording-started'; uri: string }
  /** 녹음 파일이 다 쓰여 재생해도 되는 시점 */
  | { type: 'recording-saved'; uri: string }
  | { type: 'error'; code: SpeechErrorCode };

/** 듣기를 막고 있는 권한. iOS는 마이크와 음성 인식을 따로 거절할 수 있다 */
export type MissingSpeechPermission = 'microphone' | 'speech-recognition' | 'both';

/** 허용되지 않았으면 무엇이 막고 있는지(`missing`)를 함께 준다 */
export type SpeechPermission =
  | (OsPermission & { status: 'granted' })
  | (OsPermission & {
      status: Exclude<OsPermissionStatus, 'granted'>;
      missing: MissingSpeechPermission;
    });

export interface SpeechCapabilities {
  isAvailable: boolean;
  /** 이 언어와 모드를 기기 안에서 인식한다(Android는 언어 모델 설치, iOS는 말로 메모 + 기기 기본 언어) */
  canRecognizeOnDevice: boolean;
  /** 기기 인식을 지원하지만 이 언어 모델이 없어 받을 수 있다(Android) */
  canDownloadOnDeviceModel: boolean;
  canSaveRecording: boolean;
  /** 말 사이 침묵에도 끊기지 않는 연속 인식(Android 13+) */
  canContinue: boolean;
}

export type OfflineModelResult = 'downloaded' | 'scheduled' | 'dialog-opened' | 'unavailable';

export interface SpeechStartOptions {
  locale: SpeechLocale;
  mode: SpeechMode;
  /** 인식을 돕는 내 단어. 네트워크 인식(`isOnDevice`가 false)에는 비워서 보낸다. 어댑터는 받은 그대로 쓴다 */
  hintWords: readonly string[];
  /** 기기 안 인식을 쓴다. `getCapabilities().canRecognizeOnDevice`일 때만 켠다 */
  isOnDevice: boolean;
  /** `note`에서 녹음 파일을 남길 폴더. null이면 남기지 않는다 */
  recordingDirectory: string | null;
}

export interface SpeechRecognizer {
  /** 필요한 권한은 언어마다 다르다. 기기 안에서 인식할 수 없는 언어는 음성 인식 권한도 필요하다 */
  getPermission(mode: SpeechMode, locale: SpeechLocale): Promise<SpeechPermission>;
  requestPermission(mode: SpeechMode, locale: SpeechLocale): Promise<SpeechPermission>;
  getCapabilities(mode: SpeechMode, locale: SpeechLocale): Promise<SpeechCapabilities>;
  requestOfflineModel(locale: SpeechLocale): Promise<OfflineModelResult>;
  start(options: SpeechStartOptions): void;
  stop(): void;
  abort(): void;
  subscribe(listener: (event: SpeechEvent) => void): () => void;
}
