import { Injectable } from "@nestjs/common";

import { UserSignupReaderPort } from "#api/modules/identity/users/identity-users.public";

import { SignupStatsReaderPort } from "../../application/ports/signup-stats.reader.port.js";
import type { SignupStatsReadModel } from "../../application/read-models/signup-stats.read-model.js";

// 가입 수와 총 사용자 수는 identity가 센다. 기존 사용자가 연결한 로그인 수단은 가입으로 세지 않는다
@Injectable()
export class IdentitySignupStatsAdapter extends SignupStatsReaderPort {
  readonly #signupReader: Pick<
    UserSignupReaderPort,
    "countSignupsByMethod" | "countRegisteredUsers"
  >;

  constructor(signupReader: UserSignupReaderPort) {
    super();
    this.#signupReader = signupReader;
  }

  async getSignupStats(
    start: Temporal.Instant,
    end: Temporal.Instant,
  ): Promise<SignupStatsReadModel> {
    const signups = await this.#signupReader.countSignupsByMethod({ start, end });
    const totalUsers = await this.#signupReader.countRegisteredUsers();
    return {
      signupsByProvider: signups.map((signup) => ({
        provider: signup.signupMethod,
        count: signup.count,
      })),
      totalUsers,
    };
  }
}
