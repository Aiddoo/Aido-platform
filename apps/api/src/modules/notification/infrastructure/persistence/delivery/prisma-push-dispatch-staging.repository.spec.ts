import { createMockTransactionHost, nativeRows } from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { PrismaPushDispatchStagingRepository } from "./prisma-push-dispatch-staging.repository.js";

describe("PrismaPushDispatchStagingRepository", () => {
  let repository: PrismaPushDispatchStagingRepository;
  let db: MockDatabaseContext;

  beforeEach(async () => {
    db = createMockDatabaseContext();
    repository = new PrismaPushDispatchStagingRepository(createMockTransactionHost(db));
  });

  it("빈 배치는 dispatch와 outbox를 쓰지 않는다", async () => {
    await expect(repository.stageMany([])).resolves.toEqual([]);
    expect(db.orm.public.PushDispatch.createAll).not.toHaveBeenCalled();
    expect(db.orm.public.PushDispatchOutbox.createAndCount).not.toHaveBeenCalled();
  });

  it("dispatch insert 결과를 같은 호출에서 전용 outbox로 staging한다", async () => {
    db.orm.public.PushDispatch.createAll.mockReturnValue(
      nativeRows([{ id: 51, notificationId: 21 }]),
    );
    db.orm.public.PushDispatchOutbox.createAndCount.mockResolvedValue(1);

    await expect(
      repository.stage({
        notificationId: 21,
        userId: "user-1",
        purpose: "TRANSACTIONAL",
        deliveryMode: "SINGLE",
        force: true,
      }),
    ).resolves.toEqual({ dispatchId: 51, notificationId: 21 });
    expect(db.orm.public.PushDispatch.createAll).toHaveBeenCalledWith([
      expect.objectContaining({ notificationId: 21, userId: "user-1", status: "PENDING" }),
    ]);
    expect(db.orm.public.PushDispatchOutbox.createAndCount).toHaveBeenCalledWith([
      { dispatchId: 51, deliveryMode: "SINGLE", force: true },
    ]);
  });

  it("DB가 partial 결과를 반환하면 outbox insert 전에 명시적으로 실패한다", async () => {
    db.orm.public.PushDispatch.createAll.mockReturnValue(
      nativeRows([{ id: 51, notificationId: 21 }]),
    );

    await expect(
      repository.stageMany([
        {
          notificationId: 21,
          userId: "user-1",
          purpose: "TRANSACTIONAL",
          deliveryMode: "BATCH",
          force: false,
        },
        {
          notificationId: 22,
          userId: "user-2",
          purpose: "TRANSACTIONAL",
          deliveryMode: "BATCH",
          force: false,
        },
      ]),
    ).rejects.toThrow("Push dispatch staging returned partial rows");
    expect(db.orm.public.PushDispatchOutbox.createAndCount).not.toHaveBeenCalled();
  });
});
