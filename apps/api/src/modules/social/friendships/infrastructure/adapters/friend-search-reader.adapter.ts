import { Injectable } from "@nestjs/common";
import { keyBy } from "es-toolkit";

import {
  type UserExclusionCondition,
  type UserSearchCriteria,
  UserSearchReaderPort,
} from "#api/modules/identity/users/identity-users.public";
import { hasNoBlockWith } from "#api/modules/social/user-blocks/social-user-blocks.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendSearchReaderPort } from "../../application/ports/friend-search.reader.port.js";
import { FriendReaderPort } from "../../application/ports/friend.reader.port.js";
import type { UserSearchResultReadModel } from "../../application/read-models/user-search-result.read-model.js";
import type { UserSearchPosition } from "../../domain/user-search-cursor.vo.js";
import type { UserSearchTerm } from "../../domain/user-search-term.vo.js";

// identity가 이름·Aido ID로 고르고, 본인과 어느 쪽이든 차단한 사람은 검색 SQL에서 빼며(차단은 NOT EXISTS 조건) 관계 표시는 친구 관계로 채운다
@Injectable()
export class FriendSearchReaderAdapter implements FriendSearchReaderPort {
  readonly #userSearchReader: UserSearchReaderPort<UserExclusionCondition>;
  readonly #friendReader: FriendReaderPort;

  constructor(
    userSearchReader: UserSearchReaderPort<UserExclusionCondition>,
    friendReader: FriendReaderPort,
  ) {
    this.#userSearchReader = userSearchReader;
    this.#friendReader = friendReader;
  }

  async searchUsers(params: {
    readonly viewerId: UserId;
    readonly term: UserSearchTerm;
    readonly after: UserSearchPosition | null;
    readonly limit: number;
  }): Promise<UserSearchResultReadModel[]> {
    const { viewerId, term, after, limit } = params;
    const matches = await this.#userSearchReader.searchActiveUsers({
      criteria: this.#criteriaFor(viewerId, term),
      after: after == null ? null : { rank: after.rank, userId: UserId.reconstitute(after.id) },
      limit,
    });
    const relations = keyBy(
      await this.#friendReader.findRelationsWith(
        viewerId,
        matches.map((match) => match.user.userId),
      ),
      (relation) => relation.userId,
    );
    return matches.map((match) => {
      const relation = relations[match.user.userId.value];
      return {
        user: {
          id: match.user.userId.value,
          userTag: match.user.userTag,
          name: match.user.name,
          profileImage: match.user.profileImage,
        },
        isFollowing: relation?.isFollowing ?? false,
        isFollower: relation?.isFollower ?? false,
        isFriend: relation?.isFriend ?? false,
        isRequestPending: relation?.isRequestPending ?? false,
        rank: match.rank,
      };
    });
  }

  countUsers(params: {
    readonly viewerId: UserId;
    readonly term: UserSearchTerm;
  }): Promise<number> {
    return this.#userSearchReader.countActiveUsers(this.#criteriaFor(params.viewerId, params.term));
  }

  #criteriaFor(viewerId: UserId, term: UserSearchTerm): UserSearchCriteria<UserExclusionCondition> {
    return {
      tag: term.upperTag,
      name: term.value,
      searcherId: viewerId,
      exclusion: (userIdColumn) => hasNoBlockWith(userIdColumn, viewerId.value),
    };
  }
}
