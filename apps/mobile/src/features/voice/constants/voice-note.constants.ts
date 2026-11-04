export const VOICE_NOTE_RETENTION_DAYS = 30;

/** 확정 문장이 이어서 들어올 때 초안 쓰기를 모으는 시간 */
export const VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS = 800;

/** 문서 폴더 아래 녹음 폴더 이름. 아래에 계정별 폴더를 둔다 */
export const VOICE_RECORDING_ROOT_DIRECTORY = 'voice-notes';

export const VOICE_RECORDING_EXTENSION = 'wav';

/** 재생 위치를 화면에 알리는 간격. 파형 한 칸과 같다 */
export const VOICE_NOTE_POSITION_INTERVAL_MS = 100;

export const WAVEFORM_BAR = {
  width: 3,
  gap: 2.4,
  /** 한 칸이 담는 소리 길이 */
  intervalMs: VOICE_NOTE_POSITION_INTERVAL_MS,
  minHeightRatio: 0.08,
} as const;

/** 이 값 이상이면 말한 구간으로 본다 */
export const SPEECH_LEVEL_THRESHOLD = 0.2;
