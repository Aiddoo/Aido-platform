import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, isNull } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { account, user, userProfile } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import { AdminNoticeUserReaderPort } from "../../application/ports/admin-notice-user.reader.port.js";
import type { AdminNoticeUser } from "../../application/read-models/admin-notice.read-model.js";

/**
 * 관리자 알림 사용자 블록 리더. 가입 방식은 처음 만든 인증 계정의 공급자다(나중에 연결한 계정이 아님).
 */
@Injectable()
export class DrizzleAdminNoticeUserReader extends AdminNoticeUserReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findById(userId: UserId): Promise<AdminNoticeUser | null> {
    const [row] = await this.#db
      .select({
        id: user.id,
        email: user.email,
        userTag: user.userTag,
        createdAt: user.createdAt,
        nickname: userProfile.name,
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(and(eq(user.id, userId.value), isNull(user.deletedAt)))
      .limit(1);
    if (row == null) {
      return null;
    }
    const [firstAccount] = await this.#db
      .select({ provider: account.provider })
      .from(account)
      .where(eq(account.userId, userId.value))
      .orderBy(asc(account.createdAt), asc(account.id))
      .limit(1);

    return {
      userId: row.id,
      email: row.email,
      ...(row.nickname != null && row.nickname !== "" && { nickname: row.nickname }),
      userTag: row.userTag,
      joinedAt: toIsoString(row.createdAt),
      ...(firstAccount != null && { signupMethod: firstAccount.provider }),
    };
  }
}
