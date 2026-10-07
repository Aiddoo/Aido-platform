import type { Mocked } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import { DuplicateNotificationError } from "../../ports/delivery/notification.repository.port.js";
import { SendFriendCompletionNotifications } from "./send-friend-completion-notifications.use-case.js";

const input = {
  friendId: "friend-1",
  friendName: "민재",
  notifyUserIds: ["user-1", "user-2"],
  timezone: "Asia/Seoul",
};

describe("SendFriendCompletionNotifications", () => {
  let useCase: SendFriendCompletionNotifications;
  let notificationHistoryReader: Mocked<
    ConstructorParameters<typeof SendFriendCompletionNotifications>[0]["notificationHistoryReader"]
  >;
  let persistBatch: Mocked<
    ConstructorParameters<typeof SendFriendCompletionNotifications>[0]["persistBatch"]
  >;
  let finalizeBatch: Mocked<
    ConstructorParameters<typeof SendFriendCompletionNotifications>[0]["finalizeBatch"]
  >;
  let unitOfWork: Mocked<
    ConstructorParameters<typeof SendFriendCompletionNotifications>[0]["unitOfWork"]
  >;
  let userSettings: Mocked<
    ConstructorParameters<typeof SendFriendCompletionNotifications>[0]["userNotificationSettings"]
  >;

  beforeEach(async () => {
    const sendFriendCompletionNotificationsDependencies = mockDeep<
      ConstructorParameters<typeof SendFriendCompletionNotifications>[0]
    >({
      notificationHistoryReader:
        mock<
          ConstructorParameters<
            typeof SendFriendCompletionNotifications
          >[0]["notificationHistoryReader"]
        >(),
      userNotificationSettings:
        mock<
          ConstructorParameters<
            typeof SendFriendCompletionNotifications
          >[0]["userNotificationSettings"]
        >(),
    });
    const unit = new SendFriendCompletionNotifications(
      sendFriendCompletionNotificationsDependencies,
    );
    useCase = unit;
    notificationHistoryReader =
      sendFriendCompletionNotificationsDependencies.notificationHistoryReader;
    persistBatch = sendFriendCompletionNotificationsDependencies.persistBatch;
    finalizeBatch = sendFriendCompletionNotificationsDependencies.finalizeBatch;
    unitOfWork = sendFriendCompletionNotificationsDependencies.unitOfWork;
    userSettings = sendFriendCompletionNotificationsDependencies.userNotificationSettings;
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
    userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([]);
    unitOfWork.run.mockImplementation((work) => work());
    persistBatch.execute.mockResolvedValue({ count: 2, sourceData: [] });
    finalizeBatch.execute.mockResolvedValue({ count: 2 });
  });

  it("UoW 전에 외부 정보를 조회하고 영속화 후에만 후속 작업을 실행한다", async () => {
    const events: string[] = [];
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockImplementation(async () => {
      events.push("dedup-read");
      return new Set();
    });
    userSettings.getPreferenceRecordsByUserIds.mockImplementation(async () => {
      events.push("preference-read");
      return [];
    });
    unitOfWork.run.mockImplementation(async (work) => {
      events.push("uow-start");
      const result = await work();
      events.push("uow-end");
      return result;
    });
    persistBatch.execute.mockImplementation(async (notifications) => {
      events.push("persist");
      return { count: notifications.length, sourceData: notifications };
    });
    finalizeBatch.execute.mockImplementation(async () => {
      events.push("finalize-post-commit");
      return { count: 2 };
    });

    await useCase.execute(input);

    expect(events).toEqual([
      "dedup-read",
      "preference-read",
      "uow-start",
      "persist",
      "uow-end",
      "finalize-post-commit",
    ]);
    expect(persistBatch.execute).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ userId: "user-1", friendId: "friend-1" }),
        expect.objectContaining({ userId: "user-2", friendId: "friend-1" }),
      ]),
    );
  });

  it("이미 알림을 받은 사용자를 제외하고 대상이 없으면 발송을 건너뛴다", async () => {
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(
      new Set(["user-1", "user-2"]),
    );

    await useCase.execute(input);

    expect(userSettings.getPreferenceRecordsByUserIds).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("영속화 중 중복 오류가 나면 다른 실행의 성공으로 처리한다", async () => {
    unitOfWork.run.mockRejectedValue(new DuplicateNotificationError());

    await expect(useCase.execute(input)).resolves.toBeUndefined();
    expect(finalizeBatch.execute).not.toHaveBeenCalled();
  });
});
