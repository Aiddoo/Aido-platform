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
 * 말소리 크기의 음량이 들리는데 글자 없는 구간만 이어지면 인식기가 멈춘 것으로 보고 다시 연다.
 * Android는 이때 `end`가 오지 않아 앱이 달리 알 수 없다. 구간은 약 3초마다 닫히므로(QA 로그) 두 번이면 약 6초다.
 * 시끄러운 곳에서도 녹음 파일이 잘게 쪼개지지 않게 간격을 둔다.
 */
export const VOICE_STALL_RESTART = { emptySegmentLimit: 2, minIntervalMs: 30_000 } as const;

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
  minRadiusRatio: 0.4,
  maxRadiusRatio: 0.62,
  /** 소리가 커질 때와 잦아들 때 음량을 따라가는 시간. 잦아들 때가 길어 말이 멈추면 천천히 가라앉는다 */
  attackMs: 70,
  releaseMs: 520,
  /** 말소리 크기가 가장 클 때 고리가 한 번 퍼지는 시간 */
  ringPeriodMs: 1_100,
  ringGrowRatio: 0.55,
  /** 조용할 때 원 밝기 */
  quietOpacity: 0.72,
} as const;

export const VOICE_EDGE_GLOW = {
  /** 빛이 시트 바깥으로 번지는 정도. 캔버스는 이 값의 3배만큼 시트보다 크다 */
  blur: 14,
  /** 시트 테두리에 붙는 또렷한 선 굵기 */
  rimWidth: 1.5,
  /** 말소리 크기가 가장 클 때 한 바퀴 도는 시간 */
  rotationPeriodMs: 5_000,
  minOpacity: 0.35,
  attackMs: 90,
  releaseMs: 700,
} as const;
