import type { Database } from "#api/platform/database/database.client";
import {
  account,
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
  accounts?: RelatedInput<typeof account>[];
}

type UserInput = Omit<typeof user.$inferInsert, "updatedAt"> &
  Partial<Pick<typeof user.$inferInsert, "updatedAt">>;

/** 운영의 사용자 생성처럼 사용자와 연관 행을 한 트랜잭션에서 만든다. */
export function createUserDatabaseFixture(
  client: Database,
  userInput: UserInput,
  related: RelatedFixtures,
) {
  return client.transaction(async (tx) => {
    const [created] = await tx
      .insert(user)
      .values({ updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()), ...userInput })
      .returning();
    if (created == null) {
      throw new Error("user fixture was not created");
    }
    const userId = created.id;
    if (related.profile !== undefined) {
      await tx.insert(userProfile).values({ ...related.profile, userId });
    }
    if (related.preference !== undefined) {
      await tx.insert(userPreference).values({ ...related.preference, userId });
    }
    if (related.consent !== undefined) {
      await tx.insert(userConsent).values({ ...related.consent, userId });
    }
    if (related.location !== undefined) {
      await tx.insert(userLocation).values({ ...related.location, userId });
    }
    if (related.accounts !== undefined && related.accounts.length > 0) {
      await tx.insert(account).values(related.accounts.map((item) => ({ ...item, userId })));
    }
    if (related.pushTokens !== undefined) {
      await tx.insert(pushToken).values({ ...related.pushTokens, userId });
    }
    return created;
  });
}
