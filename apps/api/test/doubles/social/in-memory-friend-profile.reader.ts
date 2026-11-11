import { FriendProfileReaderPort } from "#api/modules/social/friends/application/ports/friend-profile.reader.port";
import type { FriendUserReadModel } from "#api/modules/social/friends/application/read-models/friend.read-model";
import type { UserTag } from "#api/modules/social/friends/domain/user-tag.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface FriendProfile {
  readonly user: FriendUserReadModel;
  readonly isActive: boolean;
}

// 사용자 요약을 들고 있다가 친구 목록 InMemory 조회 대역에도 같은 값을 준다
export class InMemoryFriendProfileReader extends FriendProfileReaderPort {
  readonly #profiles = new Map<string, FriendProfile>();

  addUser(input: {
    readonly id: string;
    readonly userTag: string;
    readonly name?: string | null;
    readonly profileImage?: string | null;
    readonly isActive?: boolean;
  }): FriendUserReadModel {
    const user = {
      id: input.id,
      userTag: input.userTag,
      name: input.name ?? null,
      profileImage: input.profileImage ?? null,
    };
    this.#profiles.set(input.id, { user, isActive: input.isActive ?? true });
    return user;
  }

  findUser(userId: string): FriendUserReadModel | null {
    return this.#profiles.get(userId)?.user ?? null;
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    return this.#profiles.get(userId.value)?.isActive === true;
  }

  async findActiveUserIdByTag(userTag: UserTag): Promise<UserId | null> {
    const found = [...this.#profiles.values()].find(
      (profile) => profile.isActive && profile.user.userTag === userTag.value,
    );
    return found == null ? null : UserId.reconstitute(found.user.id);
  }

  async findDisplayName(userId: UserId): Promise<string | null> {
    const user = this.findUser(userId.value);
    return user == null ? null : (user.name ?? user.userTag);
  }
}
