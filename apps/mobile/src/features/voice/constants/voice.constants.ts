import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

/** 저장한 인식 언어가 없을 때 앱 언어를 따른다 */
export const APP_LANGUAGE_SPEECH_LOCALE = {
  ko: 'ko-KR',
  en: 'en-US',
} as const satisfies Record<ResolvedLanguage, SpeechLocale>;

/** 빠른 말하기 한 번에 들을 수 있는 최대 길이. 넘기면 말로 메모하기를 권한다 */
export const QUICK_CAPTURE_MAX_SECONDS = 90;

/** 말이 이만큼 멈추면 자동으로 마무리한다 */
export const AUTO_FINISH_SILENCE_MS = 2_500;

/** 이 음량(0..1)을 넘으면 말하는 중으로 본다 */
export const SPEAKING_VOLUME_THRESHOLD = 0.18;

/** 인식기가 고유명사를 맞히도록 알려 주는 단어의 최대 개수(SDK 권장 상한) */
export const SPEECH_CONTEXT_MAX_STRINGS = 100;

/** 인식기에 알려 줄 최근 할 일 제목의 최대 개수 */
export const SPEECH_CONTEXT_RECENT_TODO_LIMIT = 60;

/** 듣는 중 패널이 차지하는 화면 높이 비율 */
export const LISTENING_PANEL_HEIGHT_RATIO = 0.56;

export const VOICE_ORB = {
  /** 원 반지름(R)에 대한 크기 비율. 음량에 따라 이 범위에서만 변한다 */
  minRadiusRatio: 0.54,
  maxRadiusRatio: 0.66,
  /** 음량을 따라가는 속도. 클수록 빠르게 반응한다 */
  smoothing: 0.08,
  ringCount: 2,
  ringPeriodMs: 2_600,
  ringGrowRatio: 0.55,
  /** 정지 상태(모션 줄이기·계획 중) 원 크기 */
  restRadiusRatio: 0.58,
} as const;

export const VOICE_WAVEFORM = {
  barCount: 48,
  barWidth: 3,
  barGap: 3,
  height: 36,
  /** 샘플을 흘려보내는 간격 */
  sampleIntervalMs: 50,
  minBarRatio: 0.08,
} as const;

export const VOICE_EDGE_GLOW = {
  strokeWidth: 3,
  blur: 10,
  rotationPeriodMs: 5_000,
  minOpacity: 0.35,
} as const;
