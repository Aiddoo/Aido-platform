import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

import type { FollowReader } from "../follow.reader.js";

export interface GetFriendResourceLimitInput {
  readonly userId: string;
}

export interface GetFriendResourceLimitResult {
  readonly friendCount: number;
  readonly maxCount: number | null;
}

interface GetFriendResourceLimitDependencies {
  readonly reader: Pick<FollowReader, "countFriends">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getLimit">;
}

export class GetFriendResourceLimitUseCase {
  readonly #dependencies: GetFriendResourceLimitDependencies;

  constructor(dependencies: GetFriendResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetFriendResourceLimitInput): Promise<GetFriendResourceLimitResult> {
    const [maxCount, friendCount] = await Promise.all([
      this.#dependencies.entitlementReader.getLimit(input.userId, "FRIEND"),
      this.#dependencies.reader.countFriends(input.userId),
    ]);
    return { friendCount, maxCount };
  }
}
