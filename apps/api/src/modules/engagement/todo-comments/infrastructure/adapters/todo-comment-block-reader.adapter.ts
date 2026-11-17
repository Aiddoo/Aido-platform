import { Inject, Injectable } from "@nestjs/common";

import { UserBlockReaderPort } from "#api/modules/social/blocks/social-block-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentBlockReaderPort } from "../../application/ports/todo-comment-block-reader.port.js";

@Injectable()
export class TodoCommentBlockReaderAdapter implements TodoCommentBlockReaderPort {
  readonly #userBlockReader: UserBlockReaderPort;

  constructor(@Inject(UserBlockReaderPort) userBlockReader: UserBlockReaderPort) {
    this.#userBlockReader = userBlockReader;
  }

  findBlockedCounterpartIds(
    viewerId: UserId,
    candidateUserIds: readonly UserId[],
  ): Promise<ReadonlySet<string>> {
    return this.#userBlockReader.findBlockedCounterpartIds(viewerId, candidateUserIds);
  }
}
