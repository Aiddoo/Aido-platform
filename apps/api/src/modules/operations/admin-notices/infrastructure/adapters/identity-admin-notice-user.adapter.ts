import { Injectable } from "@nestjs/common";

import { UserSignupReaderPort } from "#api/modules/identity/users/identity-users.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import { AdminNoticeUserReaderPort } from "../../application/ports/admin-notice-user.reader.port.js";
import type { AdminNoticeUser } from "../../domain/admin-notice.aggregate.js";

// 사용자 블록은 identity 가입 정보에서 알림 칸만 옮긴다. 가입 방식은 처음 만든 로그인 수단이다
@Injectable()
export class IdentityAdminNoticeUserAdapter extends AdminNoticeUserReaderPort {
  readonly #signupReader: Pick<UserSignupReaderPort, "findSignup">;

  constructor(signupReader: UserSignupReaderPort) {
    super();
    this.#signupReader = signupReader;
  }

  async findById(userId: UserId): Promise<AdminNoticeUser | null> {
    const signup = await this.#signupReader.findSignup(userId);
    if (signup == null) {
      return null;
    }
    return {
      userId: signup.userId.value,
      email: signup.email,
      ...(signup.name != null && { nickname: signup.name }),
      userTag: signup.userTag,
      joinedAt: toIsoString(signup.signedUpAt),
      ...(signup.signupMethod != null && { signupMethod: signup.signupMethod }),
    };
  }
}
