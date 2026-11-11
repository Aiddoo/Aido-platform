import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserMutationLockPort } from "../../application/ports/user-mutation-lock.port.js";
import { DrizzleUserRepository } from "../persistence/drizzle-user.repository.js";

/** 같은 사용자의 상태를 바꾸는 요청을 User 행 잠금(FOR NO KEY UPDATE)으로 직렬화한다. 사용자가 없으면 false */
@Injectable()
export class UserMutationLockAdapter extends UserMutationLockPort {
  readonly #users: DrizzleUserRepository;

  constructor(users: DrizzleUserRepository) {
    super();
    this.#users = users;
  }

  async lockById(userId: UserId): Promise<boolean> {
    return (await this.#users.findByIdForUpdate(userId)) != null;
  }
}
