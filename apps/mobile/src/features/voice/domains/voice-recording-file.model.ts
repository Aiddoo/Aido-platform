import type { LocalFileEntry } from '@src/core/ports/local-file-system';
import { HOUR_MS } from '@src/shared/constants/time-units';
import { type Instant, toEpochMs } from '@src/shared/date/instant';

/** 글자 없이 실패한 채 앱을 끄면 남는 고아 녹음 파일의 보관 시간. 쓰는 중인 파일만 피하면 되어 짧다 */
const VOICE_RECORDING_ORPHAN_RETENTION_MS = HOUR_MS;

// 어느 초안도 가리키지 않는 녹음 파일의 보관 기한. 수정 시각을 모르면 기한이 지난 것으로 본다
function isRecordingFileExpired({ modifiedAtMs }: LocalFileEntry, now: Instant): boolean {
  return (
    modifiedAtMs == null || toEpochMs(now) - modifiedAtMs >= VOICE_RECORDING_ORPHAN_RETENTION_MS
  );
}

/** 기기에 남은 녹음 파일 */
export const VoiceRecordingFilePolicy = {
  isRecordingFileExpired,
} as const;
