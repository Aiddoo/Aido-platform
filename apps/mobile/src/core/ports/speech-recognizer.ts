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
  /** 0(조용함)..1(큼) */
  | { type: 'volume'; level: number }
  /** 이 구간의 녹음 파일을 쓰기 시작했다. 같은 `uri`로 `recording-saved`가 온다 */
  | { type: 'recording-started'; uri: string }
  /** 녹음 파일이 다 쓰여 재생해도 되는 시점 */
  | { type: 'recording-saved'; uri: string }
  | { type: 'error'; code: SpeechErrorCode };

export interface PermissionSnapshot {
  isGranted: boolean;
  canAskAgain: boolean;
}

export interface SpeechCapabilities {
  isAvailable: boolean;
  /** 이 언어를 기기 안에서 인식할 수 있다(Android는 언어 모델이 설치돼 있어야 한다) */
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
  /** 내 카테고리·할 일 이름처럼 잘 틀리는 고유명사 */
  contextualStrings: readonly string[];
  /** 기기 안 인식을 쓴다. `getCapabilities().canRecognizeOnDevice`일 때만 켠다 */
  isOnDevice: boolean;
  /** `note`에서 녹음 파일을 남길 폴더. null이면 남기지 않는다 */
  recordingDirectory: string | null;
}

export interface SpeechRecognizer {
  getPermission(mode: SpeechMode): Promise<PermissionSnapshot>;
  requestPermission(mode: SpeechMode): Promise<PermissionSnapshot>;
  getCapabilities(locale: SpeechLocale): Promise<SpeechCapabilities>;
  requestOfflineModel(locale: SpeechLocale): Promise<OfflineModelResult>;
  start(options: SpeechStartOptions): void;
  /** 듣기를 멈추고 남은 결과를 마지막으로 보낸다 */
  stop(): void;
  /** 결과 없이 바로 끝낸다 */
  abort(): void;
  /** 반환 함수로 구독을 끝낸다 */
  subscribe(listener: (event: SpeechEvent) => void): () => void;
}
