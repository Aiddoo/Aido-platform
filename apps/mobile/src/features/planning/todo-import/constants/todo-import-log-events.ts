/** 일정 제목·캘린더 이름·id는 싣지 않고 단계·개수·코드만 남긴다 */
export const TODO_IMPORT_LOG_EVENT = {
  SOURCE_READ_FAILED: 'todo-import.source-read.failed',
  SOURCE_PERMISSION_MISSING: 'todo-import.source-permission.missing',
  UPLOAD_CHUNK_RETRYING: 'todo-import.upload-chunk.retrying',
  UPLOAD_PAUSED: 'todo-import.upload.paused',
  UPLOAD_REJECTED: 'todo-import.upload.rejected',
  UPLOAD_CANCEL_FAILED: 'todo-import.upload-cancel.failed',
  SESSION_FINGERPRINT_MISMATCH: 'todo-import.session.fingerprint-mismatch',
  SESSION_WRITE_DROPPED_AFTER_SIGN_OUT: 'todo-import.session.write-dropped-after-sign-out',
  RESUME_FAILED: 'todo-import.resume.failed',
} as const;
