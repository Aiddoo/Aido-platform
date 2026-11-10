import { Inject, Injectable } from "@nestjs/common";

import {
  USER_BLOCK_READER,
  type UserBlockReaderPort,
} from "#api/modules/social/blocks/social-blocks.public";

import { TodoCommentBlockReaderPort } from "../../application/ports/todo-comment-block-reader.port.js";

/** social이 클래스 토큰을 열 때까지 옛 Symbol 토큰으로 차단 관계를 읽는다 */
@Injectable()
export class TodoCommentBlockReaderAdapter implements TodoCommentBlockReaderPort {
  readonly #userBlockReader: UserBlockReaderPort;

  constructor(@Inject(USER_BLOCK_READER) userBlockReader: UserBlockReaderPort) {
    this.#userBlockReader = userBlockReader;
  }

  findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    return this.#userBlockReader.findBlockedCounterpartIds(viewerId, candidateUserIds);
  }
}
