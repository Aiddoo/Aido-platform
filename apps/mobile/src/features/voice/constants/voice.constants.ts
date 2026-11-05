import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

/** 저장한 인식 언어가 없을 때 앱 언어를 따른다 */
export const APP_LANGUAGE_SPEECH_LOCALE = {
  ko: 'ko-KR',
  en: 'en-US',
} as const satisfies Record<ResolvedLanguage, SpeechLocale>;

/** 빠른 말하기 한 번에 들을 수 있는 최대 길이. 넘기면 말로 메모하기를 권한다 */
export const QUICK_CAPTURE_MAX_SECONDS = 90;

/** 듣기를 시작하라고 한 뒤 인식기가 이 안에 시작을 알리지 않으면 실패로 보고 글자를 들고 멈춘다 */
export const VOICE_PREPARING_TIMEOUT_MS = 10_000;

/** 말이 이만큼 멈추면 자동으로 마무리한다 */
export const AUTO_FINISH_SILENCE_MS = 2_500;

/** 이 음량(0..1)을 넘으면 말하는 중으로 본다 */
export const SPEAKING_VOLUME_THRESHOLD = 0.18;

/**
 * 말소리 크기의 음량이 들리는데 글자가 오지 않으면 인식기가 멈춘 것으로 보고 다시 연다.
 * Android는 멈춘 동안 빈 구간 신호(`no-match`)도 `end`도 주지 않아 시간으로만 알 수 있다.
 * - `textlessMs`: 마지막 글자 뒤로 글자 없이 지난 시간. QA 로그에서 말 구간이 약 3초마다 닫히므로 두 구간이다.
 * - `voicedMs`: 그동안 말소리 크기로 들린 시간의 합. 기침·문소리 몇 번으로는 닿지 않는 길이다.
 * - `maxSampleGapMs`: 음량은 50ms마다 온다. 이보다 벌어진 틈은 들은 시간으로 세지 않는다.
 * - `minIntervalMs`: 글자 없이 다시 연 뒤 기다리는 시간. 시끄러운 곳에서 녹음 파일이 잘게 쪼개지지 않게 한다.
 */
export const VOICE_STALL_RESTART = {
  textlessMs: 6_000,
  voicedMs: 3_000,
  maxSampleGapMs: 250,
  minIntervalMs: 30_000,
} as const;

/** 단어 신뢰도(0..1)가 이보다 낮으면 잘못 들었을 수 있다고 밑줄을 친다 */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** 인식기가 고유명사를 맞히도록 알려 주는 단어의 최대 개수(SDK 권장 상한) */
export const SPEECH_CONTEXT_MAX_STRINGS = 100;

/** 인식기에 알려 줄 최근 할 일 제목의 최대 개수 */
export const SPEECH_CONTEXT_RECENT_TODO_LIMIT = 60;

/** 서버가 아직 처리 중(AI_1314)이면 같은 키로 잠시 뒤 다시 묻는다. 차감은 한 번뿐이다 */
export const PLAN_IN_PROGRESS_RETRY = { maxCount: 3, delayMs: 2_000 } as const;

/** 듣는 시간 시계를 다시 그리는 간격 */
export const VOICE_CLOCK_TICK_MS = 1_000;

/** 듣는 중 패널이 차지하는 화면 높이 비율 */
export const LISTENING_PANEL_HEIGHT_RATIO = 0.56;

/**
 * 구와 테두리 빛의 그라데이션 중간색. 팔레트에 없는 장식용 색이라 토큰 대신 여기 모은다.
 * 그라데이션 끝색은 토큰 `main`을 쓴다.
 */
export const VOICE_GRADIENT_COLORS = {
  orbPeach: '#ffc2a3',
  orbCoral: '#ff8a5c',
  glowApricot: '#ffb07a',
  glowRose: '#ff5e7e',
  glowCream: '#ffd0a8',
} as const;

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
