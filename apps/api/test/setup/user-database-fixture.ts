import type { Database } from "#api/platform/database/database.client";
import {
  linkedAccount,
  pushToken,
  user,
  userConsent,
  userLocation,
  userPreference,
  userProfile,
} from "#api/platform/database/schema/index";

type RelatedInput<T extends { $inferInsert: { userId: string } }> = Omit<
  T["$inferInsert"],
  "userId"
>;

interface RelatedFixtures {
  profile?: RelatedInput<typeof userProfile>;
  preference?: RelatedInput<typeof userPreference>;
  consent?: RelatedInput<typeof userConsent>;
  location?: RelatedInput<typeof userLocation>;
  pushTokens?: RelatedInput<typeof pushToken>;
  accounts?: RelatedInput<typeof linkedAccount>[];
}

type UserInput = Omit<typeof user.$inferInsert, "updatedAt"> &
  Partial<Pick<typeof user.$inferInsert, "updatedAt">>;

/** 운영의 사용자 생성처럼 사용자와 연관 행을 한 트랜잭션에서 만든다. */
export function createUserDatabaseFixture(
  client: Database,
  userInput: UserInput,
  related: RelatedFixtures,
) {
  return client.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(user)
      .values({ updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()), ...userInput })
      .returning();
    if (created == null) {
      throw new Error("user fixture was not created");
    }
    const userId = created.id;
    if (related.profile !== undefined) {
      await transaction.insert(userProfile).values({ ...related.profile, userId });
    }
    if (related.preference !== undefined) {
      await transaction.insert(userPreference).values({ ...related.preference, userId });
    }
    if (related.consent !== undefined) {
      await transaction.insert(userConsent).values({ ...related.consent, userId });
    }
    if (related.location !== undefined) {
      await transaction.insert(userLocation).values({ ...related.location, userId });
    }
    if (related.accounts !== undefined && related.accounts.length > 0) {
      await transaction
        .insert(linkedAccount)
        .values(related.accounts.map((item) => ({ ...item, userId })));
    }
    if (related.pushTokens !== undefined) {
      await transaction.insert(pushToken).values({ ...related.pushTokens, userId });
    }
    return created;
  });
}
