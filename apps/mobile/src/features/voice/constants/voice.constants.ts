export const QUICK_CAPTURE_MAX_SECONDS = 90;

/** 듣기를 시작하라고 한 뒤 인식기가 이 안에 시작을 알리지 않으면 실패로 보고 글자를 들고 멈춘다 */
export const VOICE_PREPARING_TIMEOUT_MS = 10_000;

export const AUTO_FINISH_SILENCE_MS = 2_500;

/** 인식기가 고유명사를 맞히도록 알려 주는 단어의 최대 개수(SDK 권장 상한) */
export const SPEECH_CONTEXT_MAX_STRINGS = 100;

export const SPEECH_CONTEXT_RECENT_TODO_LIMIT = 60;

/** 서버가 아직 처리 중(AI_1314)이면 같은 키로 잠시 뒤 다시 묻는다. 차감은 한 번뿐이다 */
export const PLAN_IN_PROGRESS_RETRY = { maxCount: 3, delayMs: 2_000 } as const;

export const VOICE_CLOCK_TICK_MS = 1_000;

export const LISTENING_PANEL_HEIGHT = { windowRatio: 0.56, min: 420 } as const;

/** Android 일부 인식기는 말이 끝나면 음량 이벤트를 보내지 않는다(QA 로그). 이만큼 끊기면 소리 없음으로 본다 */
export const VOICE_NO_VOLUME_GAP_MS = 300;

/** 팔레트에 없는 장식용 그라데이션 중간색이라 토큰 대신 여기 둔다. 끝색은 토큰 `main`이다 */
export const VOICE_GRADIENT_COLORS = {
  orbPeach: '#ffc2a3',
  orbCoral: '#ff8a5c',
  glowApricot: '#ffb07a',
  glowRose: '#ff5e7e',
  glowCream: '#ffd0a8',
} as const;

export const VOICE_VISUAL = {
  height: 84,
  orbSize: 72,
  attackMs: 70,
  releaseMs: 520,
  maxFrameMs: 50,
  settleMs: 400,
} as const;

export const VOICE_VISUAL_BARS = {
  /** 560pt 시트의 한쪽을 채우는 칸 수 */
  maxCount: 40,
  width: 3,
  step: 6,
  startOffset: 38,
  minHeight: 3,
  heightMargin: 22,
  falloff: 0.45,
  intervalMs: 70,
  followMs: 37,
  reducedMotionLevel: 0.12,
  edgeOpacity: 0.35,
} as const;

export const VOICE_LIGHT_ORB = {
  radius: 22,
  growRatio: 0.22,
  /** 하이라이트 중심이 구 중심에서 왼쪽 위로 벗어나는 반지름 비율 */
  highlightOffsetX: 0.35,
  highlightOffsetY: 0.4,
  /** 하이라이트 그라데이션이 퍼지는 반지름 배수와 색 경계 */
  highlightRadiusRatio: 1.8,
  gradientStops: [0, 0.55, 1],
};

export const VOICE_FRAME_BUDGET = {
  /** 30fps 아래 */
  slowFrameMs: 34,
  sustainedSlowMs: 2_000,
  /** 앱을 다녀오면 프레임이 크게 벌어진다. 기기 성능이 아니므로 세지 않는다 */
  ignoreFrameMs: 500,
} as const;

export const VOICE_EDGE_GLOW = {
  blur: 14,
  rimWidth: 1.5,
  rotationPeriodMs: 5_000,
  minOpacity: 0.35,
  attackMs: 90,
  releaseMs: 700,
} as const;
