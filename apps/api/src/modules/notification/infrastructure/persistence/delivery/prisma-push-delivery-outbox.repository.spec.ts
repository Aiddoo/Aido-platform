import { and, or } from "@prisma/orm-postgres/orm-client";

import {
  assertNativeWhere,
  createMockTransactionHost,
  nativeRows,
} from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { PrismaPushDeliveryOutboxRepository } from "./prisma-push-delivery-outbox.repository.js";

describe("PrismaPushDeliveryOutboxRepository", () => {
  let repository: PrismaPushDeliveryOutboxRepository;
  let db: MockDatabaseContext;

  beforeEach(async () => {
    db = createMockDatabaseContext();
    db.orm.public.PushDispatchOutbox.all.mockReturnValue(nativeRows([]));
    repository = new PrismaPushDeliveryOutboxRepository(createMockTransactionHost(db));
  });

  it("빈 targeted claim은 DB를 호출하지 않는다", async () => {
    await expect(repository.claimByDispatchIds([], new Date())).resolves.toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("claim 결과의 증가한 generation을 그대로 반환한다", async () => {
    asMock(db.query).mockResolvedValue([{ dispatchId: 7, publishAttempt: 4 }]);

    await expect(repository.claimAvailable({ limit: 100, lockedAt: new Date() })).resolves.toEqual([
      { dispatchId: 7, publishAttempt: 4 },
    ]);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("mark와 defer는 정렬된 generation lock 뒤 세대·상태 술어를 남긴 update를 사용한다", async () => {
    db.orm.public.PushDispatchOutbox.updateAndCount.mockResolvedValue(1);
    const publications = [{ dispatchId: 9, publishAttempt: 2 }] as const;

    await expect(repository.markPublished(publications, new Date())).resolves.toBe(1);
    await expect(
      repository.defer({ publications, availableAt: new Date(), error: "queue unavailable" }),
    ).resolves.toBe(1);

    const outbox = db.orm.public.PushDispatchOutbox;
    expect(outbox.forUpdate).toHaveBeenCalledTimes(2);
    expect(outbox.updateAndCount).toHaveBeenCalledTimes(2);
    assertNativeWhere("PushDispatchOutbox", outbox.where.mock.calls[0]?.[0], (row) =>
      and(or(and(row.dispatchId.eq(9), row.publishAttempts.eq(2))), row.status.in(["PROCESSING"])),
    );
    assertNativeWhere("PushDispatchOutbox", outbox.where.mock.calls[1]?.[0], (row) =>
      and(or(and(row.dispatchId.eq(9), row.publishAttempts.eq(2))), row.status.eq("PROCESSING")),
    );
    expect(db.execute).not.toHaveBeenCalled();
  });
});
