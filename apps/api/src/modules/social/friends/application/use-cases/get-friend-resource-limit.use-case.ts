import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FollowReaderPort } from "../ports/follow.reader.port.js";
import type { FriendLimitReaderPort } from "../ports/friend-limit.reader.port.js";

export interface GetFriendResourceLimitQuery {
  readonly userId: string;
}

export interface FriendResourceLimit {
  readonly friendCount: number;
  // null은 무제한이다
  readonly maxCount: number | null;
}

export interface GetFriendResourceLimitDependencies {
  readonly followReader: Pick<FollowReaderPort, "countFriends">;
  readonly limitReader: Pick<FriendLimitReaderPort, "readLimit">;
}

export class GetFriendResourceLimitUseCase {
  readonly #dependencies: GetFriendResourceLimitDependencies;

  constructor(dependencies: GetFriendResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetFriendResourceLimitQuery): Promise<FriendResourceLimit> {
    const { followReader, limitReader } = this.#dependencies;
    const [maxCount, friendCount] = await Promise.all([
      limitReader.readLimit(UserId.reconstitute(query.userId)),
      followReader.countFriends(query.userId),
    ]);
    return { friendCount, maxCount };
  }
}
