import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, exists, gt, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  UserSearchCriteria,
  UserSearchReaderPort,
} from "../../application/ports/user-search.reader.port.js";
import type { UserSearchMatchReadModel } from "../../application/read-models/user-brief.read-model.js";
import type { UserExclusionCondition } from "./user-conditions.query-fragment.js";

@Injectable()
export class DrizzleUserSearchReader implements UserSearchReaderPort<UserExclusionCondition> {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async searchActiveUsers(params: {
    readonly criteria: UserSearchCriteria<UserExclusionCondition>;
    readonly after: { readonly rank: number; readonly userId: UserId } | null;
    readonly limit: number;
  }): Promise<UserSearchMatchReadModel[]> {
    const { criteria, after, limit } = params;
    const candidates = this.#db
      .select({
        id: user.id,
        userTag: user.userTag,
        name: userProfile.name,
        profileImage: userProfile.profileImage,
        rank: sql<number>`CASE
          WHEN ${user.userTag} = ${criteria.tag} THEN 0
          WHEN ${user.userTag} ILIKE ${criteria.tag} || '%' THEN 1
          WHEN ${userProfile.name} ILIKE ${criteria.name} || '%' THEN 2
          ELSE 3
        END`.as("rank"),
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(
        and(
          this.#isSearchable(criteria),
          or(
            ilike(user.userTag, `%${criteria.tag}%`),
            ilike(userProfile.name, `%${criteria.name}%`),
          ),
        ),
      )
      .as("s");

    const rows = await this.#db
      .select()
      .from(candidates)
      .where(
        after == null
          ? undefined
          : or(
              gt(candidates.rank, after.rank),
              and(eq(candidates.rank, after.rank), gt(candidates.id, after.userId.value)),
            ),
      )
      .orderBy(asc(candidates.rank), asc(candidates.id))
      .limit(limit);

    return rows.map((row) => ({
      user: {
        userId: UserId.reconstitute(row.id),
        userTag: row.userTag,
        name: row.name,
        profileImage: row.profileImage,
        isDeletionPending: false,
      },
      rank: Number(row.rank),
    }));
  }

  countActiveUsers(criteria: UserSearchCriteria<UserExclusionCondition>): Promise<number> {
    return this.#db.$count(
      user,
      and(
        this.#isSearchable(criteria),
        or(
          ilike(user.userTag, `%${criteria.tag}%`),
          exists(
            this.#db
              .select({ one: sql`1` })
              .from(userProfile)
              .where(
                and(eq(userProfile.userId, user.id), ilike(userProfile.name, `%${criteria.name}%`)),
              ),
          ),
        ),
      ),
    );
  }

  #isSearchable(criteria: UserSearchCriteria<UserExclusionCondition>): SQL | undefined {
    return and(
      ne(user.id, criteria.searcherId.value),
      isNull(user.deletedAt),
      eq(user.status, "ACTIVE"),
      criteria.exclusion(user.id),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
