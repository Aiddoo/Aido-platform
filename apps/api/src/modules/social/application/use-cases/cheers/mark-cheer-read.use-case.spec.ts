import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { MarkCheerRead } from "./mark-cheer-read.use-case.js";

describe("응원 읽음 처리", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["missing", "other"])(
    "%s 기록은 소유권 오류로 거부하고 읽음 상태를 변경하지 않는다",
    async (state) => {
      // Given
      const fixture = createSocialInteractionFixture();
      const record = fixture.cheerRepository.seed({ senderId: "sender", receiverId: "receiver" });
      // When / Then
      await expect(
        new MarkCheerRead(fixture).execute({
          userId: state === "other" ? "other" : "receiver",
          cheerId: state === "missing" ? record.id + 1 : record.id,
        }),
      ).rejects.toMatchObject({ errorCode: "CHEER_1205" });
      expect(fixture.cheerRepository.records.get(record.id)?.readAt).toBeNull();
    },
  );
  it("첫 읽음 시각을 저장하고 같은 요청은 추가 쓰기 없이 기존 시각을 보존한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    const record = fixture.cheerRepository.seed({ senderId: "sender", receiverId: "receiver" });
    const useCase = new MarkCheerRead(fixture);
    // When
    await useCase.execute({ userId: "receiver", cheerId: record.id });
    vi.setSystemTime(new Date(SOCIAL_TIME.getTime() + 10000));
    const save = vi.spyOn(fixture.cheerRepository, "saveRead");
    await useCase.execute({ userId: "receiver", cheerId: record.id });
    // Then
    expect(fixture.cheerRepository.records.get(record.id)?.readAt).toEqual(SOCIAL_TIME);
    expect(save).not.toHaveBeenCalled();
  });
});
