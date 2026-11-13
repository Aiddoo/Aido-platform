/** 메모 탭에 바로 보이는 최근 말로 메모 수. 넘치면 전체 목록으로 보내 아래 메모가 밀리지 않게 한다 */
export const VOICE_NOTE_PREVIEW_COUNT = 3;

export const VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS = 800;

/** 말이 끊이지 않아도 이 시간마다는 쓴다. 앱이 꺼져도 이만큼만 잃는다 */
export const VOICE_NOTE_DRAFT_SAVE_MAX_WAIT_MS = 5_000;

export const VOICE_RECORDING_ROOT_DIRECTORY = 'voice-notes';

export const VOICE_RECORDING_EXTENSION = 'wav';

/** 재생 위치를 화면에 알리는 간격. 파형 한 칸과 같다 */
export const VOICE_NOTE_POSITION_INTERVAL_MS = 100;

export const WAVEFORM_BAR = {
  width: 3,
  gap: 2.4,
  intervalMs: VOICE_NOTE_POSITION_INTERVAL_MS,
  minHeightRatio: 0.08,
  /** 칸이 캔버스 높이에서 차지하는 최대 비율 */
  verticalShare: 0.8,
  /** 녹음 중 들고 있는 칸 수. 가장 넓은 화면의 왼쪽 절반을 채우고 남는 고정 길이다 */
  maxLiveBars: 160,
} as const;

export const SPEECH_LEVEL_THRESHOLD = 0.2;

/** 끝낸 뒤 인식기가 녹음 파일을 다 쓸 때까지 화면이 기다리는 시간. 넘기면 글자만 먼저 넘긴다 */
export const VOICE_RECORDING_SAVE_WAIT_MS = 3_000;

/** 화면이 내려간 뒤에도 늦은 녹음 파일을 받아 초안에 더하는 시간 */
export const VOICE_RECORDING_LATE_WAIT_MS = 30_000;
