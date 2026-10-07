import { MutationLockKeys } from "#api/shared/application/ports/index";
import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { SendCheer } from "./send-cheer.use-case.js";

describe("친구에게 응원 보내기", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { name: "자기 자신", receiverId: "sender", code: "CHEER_1204" },
    { name: "친구가 아닌 사용자", receiverId: "other", code: "CHEER_1203" },
  ])("$name 에게는 $code 오류로 거부하고 응원이나 알림을 저장하지 않는다", async (input) => {
    // Given
    const fixture = createSocialInteractionFixture();
    // When / Then
    await expect(
      new SendCheer({
        ...fixture,
        notifier: fixture.cheerNotifier,
        limitReader: fixture.cheerLimitReader,
      }).execute({ senderId: "sender", receiverId: input.receiverId, timezone: "UTC" }),
    ).rejects.toMatchObject({ errorCode: input.code });
    expect(fixture.cheerRepository.records.size).toBe(0);
    expect(fixture.cheerNotifier.notifications).toEqual([]);
  });
  it("일일 한도에 도달하면 추가 저장 없이 CHEER_1201로 거부한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    for (let index = 0; index < 3; index += 1)
      fixture.cheerRepository.seed({ senderId: "sender", receiverId: `previous-${index}` });
    // When / Then
    await expect(
      new SendCheer({
        ...fixture,
        notifier: fixture.cheerNotifier,
        limitReader: fixture.cheerLimitReader,
      }).execute({ senderId: "sender", receiverId: "receiver", timezone: "UTC" }),
    ).rejects.toMatchObject({ errorCode: "CHEER_1201", details: { limit: 3 } });
    expect(fixture.cheerRepository.records.size).toBe(3);
    expect(fixture.cheerNotifier.notifications).toEqual([]);
  });
  it("같은 친구의 24시간 쿨다운 동안은 구체적인 오류와 남은 시간을 반환한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.cheerRepository.seed({
      senderId: "sender",
      receiverId: "receiver",
      createdAt: new Date(SOCIAL_TIME.getTime() - 1000),
    });
    // When / Then
    await expect(
      new SendCheer({
        ...fixture,
        notifier: fixture.cheerNotifier,
        limitReader: fixture.cheerLimitReader,
      }).execute({ senderId: "sender", receiverId: "receiver", timezone: "UTC" }),
    ).rejects.toMatchObject({ errorCode: "CHEER_1202", details: { remainingSeconds: 86399 } });
    expect(fixture.cheerRepository.records.size).toBe(1);
  });
  it.each(["FREE", "ACTIVE"])(
    "%s 사용자의 성공 응원을 저장하고 프로필이 없으면 태그를 알림에 사용한다",
    async (subscriptionStatus) => {
      // Given
      const fixture = createSocialInteractionFixture();
      const sender = fixture.addUser("sender", null);
      fixture.database.users.set("sender", { role: "USER", subscriptionStatus });
      if (subscriptionStatus === "ACTIVE")
        for (let index = 0; index < 4; index += 1)
          fixture.cheerRepository.seed({ senderId: "sender", receiverId: `previous-${index}` });
      // When
      const result = await new SendCheer({
        ...fixture,
        notifier: fixture.cheerNotifier,
        limitReader: fixture.cheerLimitReader,
      }).execute({
        senderId: "sender",
        receiverId: "receiver",
        message: "응원해요",
        timezone: "UTC",
      });
      // Then
      expect(fixture.cheerRepository.records.get(result.id)).toMatchObject({
        senderId: "sender",
        receiverId: "receiver",
        message: "응원해요",
        createdAt: SOCIAL_TIME,
      });
      expect(fixture.cheerNotifier.notifications).toEqual([
        {
          cheerId: result.id,
          senderId: "sender",
          receiverId: "receiver",
          senderName: sender.userTag,
          message: "응원해요",
        },
      ]);
    },
  );
  it("잠금 대기 중 자정이 지나도 시작 시각의 quota 구간과 저장 시각을 사용한다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-07-26T14:59:59.900Z"));
    const fixture = createSocialInteractionFixture();
    const count = vi.spyOn(fixture.cheerRepository, "countSentSince");
    fixture.mutationLock.acquire = async (keys) => {
      fixture.lockCalls.push([...keys]);
      vi.setSystemTime(new Date("2026-07-26T15:00:00.100Z"));
    };
    // When
    const result = await new SendCheer({
      ...fixture,
      notifier: fixture.cheerNotifier,
      limitReader: fixture.cheerLimitReader,
    }).execute({ senderId: "sender", receiverId: "receiver", timezone: "Asia/Seoul" });
    // Then
    expect(fixture.lockCalls).toEqual([
      [
        MutationLockKeys.cheerDailyQuota("sender"),
        MutationLockKeys.cheerCooldown("sender", "receiver"),
      ],
    ]);
    expect(count).toHaveBeenCalledWith(
      "sender",
      new Date("2026-07-25T15:00:00Z"),
      new Date("2026-07-26T15:00:00Z"),
    );
    expect(result.createdAt).toEqual(new Date("2026-07-26T14:59:59.900Z"));
  });
});
