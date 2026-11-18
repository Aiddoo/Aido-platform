import type { UserRepositoryPort } from "#api/modules/identity/users/application/ports/user.repository.port";
import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 실제 잠금처럼 사용자 행이 있을 때만 잠근다. 기다림·경합은 integration이 실제 DB로 확인한다
export class InMemoryUserMutationLock extends UserMutationLockPort {
  readonly #users: Pick<UserRepositoryPort, "findById">;

  constructor(users: Pick<UserRepositoryPort, "findById">) {
    super();
    this.#users = users;
  }

  async lockById(userId: UserId): Promise<boolean> {
    return (await this.#users.findById(userId)) != null;
  }
}
