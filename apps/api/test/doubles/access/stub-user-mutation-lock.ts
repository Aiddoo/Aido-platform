import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";

import type { InMemoryAccessUser } from "./in-memory-access-state.reader.js";

// 실제 잠금처럼 사용자 행이 있을 때만 잠근다. 동시성 의미는 integration이 실제 DB로 확인한다
export class StubUserMutationLock extends UserMutationLockPort {
  readonly #users: ReadonlyMap<string, InMemoryAccessUser>;

  constructor(users: ReadonlyMap<string, InMemoryAccessUser>) {
    super();
    this.#users = users;
  }

  async lockById(userId: string): Promise<boolean> {
    return this.#users.has(userId);
  }
}
