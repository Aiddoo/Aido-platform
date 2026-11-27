import { SECOND_MS } from '@src/shared/constants/time-units';

export const QUICK_CAPTURE_MAX_SECONDS = 90;

/** 듣기를 시작하라고 한 뒤 인식기가 이 안에 시작을 알리지 않으면 실패로 보고 글자를 들고 멈춘다 */
export const VOICE_PREPARING_TIMEOUT_MS = 10 * SECOND_MS;

/** 인식기가 stop 뒤에 end를 주지 않는 기기를 위한 안전 시간. 끝내기·이어 듣기·멈춤 복구가 함께 쓴다 */
export const RECOGNIZER_END_TIMEOUT_MS = 1_500;

export const AUTO_FINISH_SILENCE_MS = 2_500;

/** 서버가 아직 처리 중(AI_1314)이면 같은 키로 잠시 뒤 다시 묻는다. 차감은 한 번뿐이다 */
export const PLAN_IN_PROGRESS_RETRY = { maxCount: 3, delayMs: 2 * SECOND_MS } as const;

export const VOICE_CLOCK_TICK_MS = SECOND_MS;

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
