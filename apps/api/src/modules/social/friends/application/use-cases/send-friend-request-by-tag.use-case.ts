import { UserTag } from "../../domain/user-tag.vo.js";
import { friendTargetTagNotFound } from "../friends.errors.js";
import type { FriendProfileReaderPort } from "../ports/friend-profile.reader.port.js";
import type {
  SendFriendRequestResult,
  SendFriendRequestUseCase,
} from "./send-friend-request.use-case.js";

export interface SendFriendRequestByTagCommand {
  readonly userId: string;
  readonly targetUserTag: string;
}

export interface SendFriendRequestByTagDependencies {
  readonly profileReader: Pick<FriendProfileReaderPort, "findActiveUserIdByTag">;
  readonly sendFriendRequest: Pick<SendFriendRequestUseCase, "execute">;
}

export class SendFriendRequestByTagUseCase {
  readonly #dependencies: SendFriendRequestByTagDependencies;

  constructor(dependencies: SendFriendRequestByTagDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendFriendRequestByTagCommand): Promise<SendFriendRequestResult> {
    const { profileReader, sendFriendRequest } = this.#dependencies;
    const targetUserId = await profileReader.findActiveUserIdByTag(
      UserTag.create(command.targetUserTag),
    );
    if (targetUserId == null) {
      throw friendTargetTagNotFound(command.targetUserTag);
    }
    return sendFriendRequest.execute({ userId: command.userId, targetUserId: targetUserId.value });
  }
}
