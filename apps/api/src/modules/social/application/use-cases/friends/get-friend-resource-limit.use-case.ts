import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

import type { FollowReader } from "../../services/friends/follow.reader.js";

export interface GetFriendResourceLimitInput {
  readonly userId: string;
}

export interface GetFriendResourceLimitResult {
  readonly friendCount: number;
  readonly maxCount: number | null;
}

interface GetFriendResourceLimitDependencies {
  readonly reader: Pick<FollowReader, "countFriends">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "limitOf">;
}

export class GetFriendResourceLimit {
  readonly #dependencies: GetFriendResourceLimitDependencies;

  constructor(dependencies: GetFriendResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetFriendResourceLimitInput): Promise<GetFriendResourceLimitResult> {
    const [maxCount, friendCount] = await Promise.all([
      this.#dependencies.entitlementReader.limitOf(input.userId, "FRIEND"),
      this.#dependencies.reader.countFriends(input.userId),
    ]);
    return { friendCount, maxCount };
  }
}
