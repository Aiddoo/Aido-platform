import { UserBriefReaderPort } from "#api/modules/identity/users/identity-users.public";
import type {
  UserAccountIdentityReadModel,
  UserBriefReadModel,
} from "#api/modules/identity/users/identity-users.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface StubUserSeed {
  readonly userId: string;
  readonly userTag?: string;
  readonly name?: string | null;
  readonly profileImage?: string | null;
  readonly isActive?: boolean;
  readonly isDeletionPending?: boolean;
  readonly joinedAt?: Temporal.Instant;
  readonly verifiedEmail?: string | null;
  readonly providerAccounts?: UserAccountIdentityReadModel["providerAccounts"];
}

// 씨앗으로 넣은 사용자만 있다. 활성(isActive 기본 true)·탈퇴 대기 여부를 씨앗마다 정한다
export class StubUserBriefReader extends UserBriefReaderPort {
  readonly #users = new Map<string, StubUserSeed>();

  constructor(seeds: readonly StubUserSeed[] = []) {
    super();
    for (const seed of seeds) {
      this.seed(seed);
    }
  }

  seed(seed: StubUserSeed): void {
    this.#users.set(seed.userId, seed);
  }

  async findByUserIds(userIds: readonly UserId[]): Promise<UserBriefReadModel[]> {
    return userIds.flatMap((userId) => {
      const seed = this.#users.get(userId.value);
      return seed == null ? [] : [toBrief(seed)];
    });
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    const seed = this.#users.get(userId.value);
    return seed != null && isActive(seed);
  }

  async findActiveUserIdByTag(userTag: string): Promise<UserId | null> {
    const seed = [...this.#users.values()].find(
      (candidate) => candidate.userTag === userTag && isActive(candidate),
    );
    return seed == null ? null : UserId.reconstitute(seed.userId);
  }

  async findAccountIdentity(userId: UserId): Promise<UserAccountIdentityReadModel | null> {
    const seed = this.#users.get(userId.value);
    if (seed == null) {
      return null;
    }
    return {
      user: toBrief(seed),
      joinedAt: seed.joinedAt ?? Temporal.Instant.from("2026-01-01T00:00:00Z"),
      verifiedEmail: seed.verifiedEmail ?? null,
      providerAccounts: seed.providerAccounts ?? [],
    };
  }
}

function isActive(seed: StubUserSeed): boolean {
  return (seed.isActive ?? true) && !(seed.isDeletionPending ?? false);
}

function toBrief(seed: StubUserSeed): UserBriefReadModel {
  return {
    userId: UserId.reconstitute(seed.userId),
    userTag: seed.userTag ?? seed.userId.slice(0, 8).toUpperCase(),
    name: seed.name ?? null,
    profileImage: seed.profileImage ?? null,
    isDeletionPending: seed.isDeletionPending ?? false,
  };
}
