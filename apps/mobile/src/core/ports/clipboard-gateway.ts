/** 클립보드에 쓰지 못했다. SDK 오류의 `code`·영문 message가 사용자 문구로 새지 않게 코드 없이 감싸고 원본은 `cause`에 둔다 */
export class ClipboardCopyError extends Error {
  constructor(cause: unknown) {
    super('Clipboard copy failed');
    this.name = 'ClipboardCopyError';
    // `new Error(msg, { cause })`는 Hermes가 무시할 수 있어 직접 대입한다
    this.cause = cause;
  }
}

export interface ClipboardGateway {
  /** 실패하면 `ClipboardCopyError`로 거절한다 */
  copy(text: string): Promise<void>;
}
