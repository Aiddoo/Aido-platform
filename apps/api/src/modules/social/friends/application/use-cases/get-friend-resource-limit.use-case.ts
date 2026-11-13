import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendLimitReaderPort } from "../ports/friend-limit.reader.port.js";
import type { MutualFriendReaderPort } from "../ports/mutual-friend.reader.port.js";

export interface GetFriendResourceLimitQuery {
  readonly userId: string;
}

export interface FriendResourceLimit {
  readonly friendCount: number;
  // null은 무제한이다
  readonly maxCount: number | null;
}

export interface GetFriendResourceLimitDependencies {
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "countFriends">;
  readonly limitReader: Pick<FriendLimitReaderPort, "readLimit">;
}

export class GetFriendResourceLimitUseCase {
  readonly #dependencies: GetFriendResourceLimitDependencies;

  constructor(dependencies: GetFriendResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetFriendResourceLimitQuery): Promise<FriendResourceLimit> {
    const { mutualFriendReader, limitReader } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const [maxCount, friendCount] = await Promise.all([
      limitReader.readLimit(userId),
      mutualFriendReader.countFriends(userId),
    ]);
    return { friendCount, maxCount };
  }
}
