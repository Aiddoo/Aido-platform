import { AdminNoticeUserReaderPort } from "#api/modules/operations/admin-notices/application/ports/admin-notice-user.reader.port";
import type { AdminNoticeUser } from "#api/modules/operations/admin-notices/application/read-models/admin-notice.read-model";

// 정해 둔 사용자(없으면 null)를 돌려주고, 오류를 주면 조회 실패를 흉내 낸다
export class StubAdminNoticeUserReader extends AdminNoticeUserReaderPort {
  readonly #result: AdminNoticeUser | null | Error;

  constructor(result: AdminNoticeUser | null | Error) {
    super();
    this.#result = result;
  }

  async findById(): Promise<AdminNoticeUser | null> {
    if (this.#result instanceof Error) {
      throw this.#result;
    }
    return this.#result;
  }
}
