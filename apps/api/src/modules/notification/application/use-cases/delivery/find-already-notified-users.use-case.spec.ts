import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type NotificationDedupPort } from "../../ports/delivery/notification-dedup.port.js";
import { type NotificationHistoryReaderPort } from "../../ports/delivery/notification-history.reader.port.js";
import { FindAlreadyNotifiedUsers } from "./find-already-notified-users.use-case.js";

const params = {
  userIds: ["user-1", "user-2"],
  type: "FRIEND_COMPLETED" as const,
  notificationDate: new Date("2026-03-09T00:00:00.000Z"),
  friendId: "friend-1",
};

describe("FindAlreadyNotifiedUsers", () => {
  let useCase: FindAlreadyNotifiedUsers;
  let notificationDedup: Mocked<NotificationDedupPort>;
  let repository: Mocked<NotificationHistoryReaderPort>;

  beforeEach(async () => {
    const findAlreadyNotifiedUsersDependencies = mockDeep<
      ConstructorParameters<typeof FindAlreadyNotifiedUsers>[0]
    >({});
    const unit = new FindAlreadyNotifiedUsers(findAlreadyNotifiedUsersDependencies);
    useCase = unit;
    notificationDedup = findAlreadyNotifiedUsersDependencies.notificationDedup;
    repository = findAlreadyNotifiedUsersDependencies.notificationHistoryReader;
    notificationDedup.warmRecipients.mockResolvedValue(undefined);
  });

  it("warm(센티넬 존재): Redis 결과에서 센티넬 제거 후 반환, DB 미조회", async () => {
    notificationDedup.readKnownRecipients.mockResolvedValue(new Set(["user-1"]));

    const result = await useCase.execute(params);

    expect(result).toEqual(new Set(["user-1"]));
    expect(repository.findAlreadyNotifiedUserIds).not.toHaveBeenCalled();
    expect(notificationDedup.warmRecipients).not.toHaveBeenCalled();
  });

  it("cold(센티넬 없음): DB fallback + Redis warm-up", async () => {
    notificationDedup.readKnownRecipients.mockResolvedValue(null);
    repository.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-2"]));

    const result = await useCase.execute(params);

    expect(result).toEqual(new Set(["user-2"]));
    expect(repository.findAlreadyNotifiedUserIds).toHaveBeenCalledWith(params);
    expect(notificationDedup.warmRecipients).toHaveBeenCalledWith(
      params.type,
      params.notificationDate,
      ["user-2"],
    );
  });
});
