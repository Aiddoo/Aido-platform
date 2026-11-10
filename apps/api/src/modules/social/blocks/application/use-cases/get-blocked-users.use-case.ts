import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserBlockId } from "../../domain/user-block-id.vo.js";
import type { BlockedUserReaderPort } from "../ports/blocked-user.reader.port.js";
import type { BlockedUserListReadModel } from "../read-models/blocked-user.read-model.js";

export interface GetBlockedUsersQuery {
  readonly blockerId: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface GetBlockedUsersDependencies {
  readonly blockedUserReader: Pick<BlockedUserReaderPort, "listByBlockerId" | "countByBlockerId">;
}

export class GetBlockedUsersUseCase {
  readonly #dependencies: GetBlockedUsersDependencies;

  constructor(dependencies: GetBlockedUsersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetBlockedUsersQuery): Promise<BlockedUserListReadModel> {
    const { blockedUserReader } = this.#dependencies;
    const size = clampPageSize(query.size);
    const blockerId = UserId.reconstitute(query.blockerId);
    const [rows, totalCount] = await Promise.all([
      blockedUserReader.listByBlockerId({
        blockerId,
        afterBlockId: query.cursor == null ? null : UserBlockId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      blockedUserReader.countByBlockerId(blockerId),
    ]);
    return {
      page: toCursorPage({ rows, size, toCursor: (blockedUser) => blockedUser.blockId }),
      totalCount,
    };
  }
}
