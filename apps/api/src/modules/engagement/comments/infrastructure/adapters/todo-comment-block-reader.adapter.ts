import { Inject, Injectable } from "@nestjs/common";

import { UserBlockReaderPort } from "#api/modules/social/blocks/social-blocks.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentBlockReaderPort } from "../../application/ports/todo-comment-block-reader.port.js";

@Injectable()
export class TodoCommentBlockReaderAdapter implements TodoCommentBlockReaderPort {
  readonly #userBlockReader: UserBlockReaderPort;

  constructor(@Inject(UserBlockReaderPort) userBlockReader: UserBlockReaderPort) {
    this.#userBlockReader = userBlockReader;
  }

  findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    return this.#userBlockReader.findBlockedCounterpartIds(
      UserId.reconstitute(viewerId),
      candidateUserIds.map((userId) => UserId.reconstitute(userId)),
    );
  }
}
