import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { NotificationHistoryReader } from "./notification-history.reader.js";

const params = {
  userIds: ["user-1", "user-2"],
  type: "FRIEND_COMPLETED" as const,
  notificationDate: new Date("2026-03-09T00:00:00.000Z"),
  friendId: "friend-1",
};

describe("NotificationHistoryReader", () => {
  let useCase: NotificationHistoryReader;
  let notificationDedup: Mocked<
    ConstructorParameters<typeof NotificationHistoryReader>[0]["notificationDedup"]
  >;
  let repository: Mocked<
    ConstructorParameters<typeof NotificationHistoryReader>[0]["notificationHistoryReader"]
  >;

  beforeEach(async () => {
    const findAlreadyNotifiedUsersDependencies = mockDeep<
      ConstructorParameters<typeof NotificationHistoryReader>[0]
    >({});
    const unit = new NotificationHistoryReader(findAlreadyNotifiedUsersDependencies);
    useCase = unit;
    notificationDedup = findAlreadyNotifiedUsersDependencies.notificationDedup;
    repository = findAlreadyNotifiedUsersDependencies.notificationHistoryReader;
    notificationDedup.warmRecipients.mockResolvedValue(undefined);
  });

  it("warm(센티넬 존재): Redis 결과에서 센티넬 제거 후 반환, DB 미조회", async () => {
    notificationDedup.readKnownRecipients.mockResolvedValue(new Set(["user-1"]));

    const result = await useCase.findAlreadyNotifiedUserIds(params);

    expect(result).toEqual(new Set(["user-1"]));
    expect(repository.findAlreadyNotifiedUserIds).not.toHaveBeenCalled();
    expect(notificationDedup.warmRecipients).not.toHaveBeenCalled();
  });

  it("cold(센티넬 없음): DB fallback + Redis warm-up", async () => {
    notificationDedup.readKnownRecipients.mockResolvedValue(null);
    repository.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-2"]));

    const result = await useCase.findAlreadyNotifiedUserIds(params);

    expect(result).toEqual(new Set(["user-2"]));
    expect(repository.findAlreadyNotifiedUserIds).toHaveBeenCalledWith(params);
    expect(notificationDedup.warmRecipients).toHaveBeenCalledWith(
      params.type,
      params.notificationDate,
      ["user-2"],
    );
  });
});
