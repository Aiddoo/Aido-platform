import {
  Resource,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

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
  readonly entitlementReader: Pick<EntitlementReaderPort, "getResourceLimit">;
}

export class GetFriendResourceLimit {
  readonly #dependencies: GetFriendResourceLimitDependencies;

  constructor(dependencies: GetFriendResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetFriendResourceLimitInput): Promise<GetFriendResourceLimitResult> {
    const [entitlement, friendCount] = await Promise.all([
      this.#dependencies.entitlementReader.getResourceLimit(input.userId, Resource.FRIEND),
      this.#dependencies.reader.countFriends(input.userId),
    ]);
    return { friendCount, maxCount: entitlement.maxCount };
  }
}
