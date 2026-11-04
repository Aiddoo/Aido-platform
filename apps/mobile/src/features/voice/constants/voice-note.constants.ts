export const VOICE_NOTE_RETENTION_DAYS = 30;

/** 초안이 가리키지 않는 녹음 파일(지운 초안의 뒤늦은 파일)을 남겨 두는 날 수 */
export const VOICE_RECORDING_ORPHAN_RETENTION_DAYS = 1;

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

/** 자막 한 카드의 최대 글자 수. 문장부호가 없어도 카드가 끝없이 길어지지 않게 끊는다 */
export const VOICE_NOTE_SENTENCE_MAX_LENGTH = 120;

/** 끝낸 뒤 인식기가 녹음 파일을 다 쓸 때까지 화면이 기다리는 시간. 넘기면 글자만 먼저 넘긴다 */
export const VOICE_RECORDING_SAVE_WAIT_MS = 3_000;

/** 화면이 내려간 뒤에도 늦은 녹음 파일을 받아 초안에 더하는 시간 */
export const VOICE_RECORDING_LATE_WAIT_MS = 30_000;
