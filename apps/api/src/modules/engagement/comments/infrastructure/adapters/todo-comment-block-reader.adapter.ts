import { Inject, Injectable } from "@nestjs/common";

import { UserBlockReaderPort } from "#api/modules/social/blocks/social-blocks.public";

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
    return this.#userBlockReader.findBlockedCounterpartIds(viewerId, candidateUserIds);
  }
}
