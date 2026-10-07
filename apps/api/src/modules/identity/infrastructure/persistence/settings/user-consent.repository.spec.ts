import { UserConsentBuilder } from "#test/builders/index";
import {
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { UserConsentRepository } from "./user-consent.repository.js";

const userId = "user-123";
const at = new Date("2027-01-01T12:00:00.000Z");

describe("UserConsentRepository — 결정된 동의 시각의 독립 필드 저장", () => {
  let repository: UserConsentRepository;
  let db: MockDatabaseContext;

  beforeEach(() => {
    db = createMockDatabaseContext();
    repository = new UserConsentRepository(createMockTransactionHost(db));
  });

  it.each([at, null])(
    "일반 마케팅 동의 시각 또는 철회를 생성·갱신 양쪽에 동일하게 저장한다: %s",
    async (agreedAt) => {
      // Given
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", UserConsentBuilder.create(userId).build()),
      );

      // When
      await repository.upsertMarketingConsent(userId, { agreedAt });

      // Then
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining(
            databaseWriteExpectation("UserConsent", { userId, marketingAgreedAt: agreedAt }),
          ),
          update: databaseWriteExpectation("UserConsent", { marketingAgreedAt: agreedAt }),
        }),
      );
    },
  );

  it.each([at, null])(
    "push 마케팅 동의는 다른 약관·마케팅 필드를 덮어쓰지 않는다: %s",
    async (agreedAt) => {
      // Given
      db.orm.public.UserConsent.upsert.mockResolvedValue(
        databaseFixture("UserConsent", UserConsentBuilder.create(userId).build()),
      );

      // When
      await repository.upsertMarketingPushConsent(userId, { agreedAt });

      // Then
      expect(db.orm.public.UserConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining(
            databaseWriteExpectation("UserConsent", { userId, marketingPushAgreedAt: agreedAt }),
          ),
          update: databaseWriteExpectation("UserConsent", { marketingPushAgreedAt: agreedAt }),
        }),
      );
    },
  );

  it("빈 사용자 목록은 DB에 조회하지 않는다", async () => {
    // Given
    const userIds: readonly string[] = [];

    // When
    expect(await repository.findByUserIds(userIds)).toEqual([]);

    // Then
    expect(db.orm.public.UserConsent.where).not.toHaveBeenCalled();
  });
});
