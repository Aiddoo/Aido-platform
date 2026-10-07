import { Cheer } from "./cheer.aggregate.js";

const CREATED_AT = new Date("2027-01-04T12:00:00.000Z");
const READ_AT = new Date("2027-01-04T13:00:00.000Z");

function createCheer(readAt: Date | null = null) {
  return Cheer.reconstitute({
    id: 1,
    senderId: "sender",
    receiverId: "receiver",
    message: null,
    readAt,
    createdAt: CREATED_AT,
  });
}

describe("Cheer 읽음 상태", () => {
  it("첫 읽음만 상태를 전이하고 재시도는 기존 읽음 시각을 유지한다", () => {
    // Given
    const cheer = createCheer();
    const input = new Date(READ_AT);

    // When
    const firstChanged = cheer.markRead(input);
    input.setUTCFullYear(2000);
    const repeatedChanged = cheer.markRead(new Date("2027-01-04T14:00:00.000Z"));
    cheer.readAt?.setUTCFullYear(2000);

    // Then
    expect(firstChanged).toBe(true);
    expect(repeatedChanged).toBe(false);
    expect(cheer.isRead()).toBe(true);
    expect(cheer.readAt).toEqual(READ_AT);
  });

  it("이미 읽은 영속 상태는 복원 후에도 다시 전이하지 않는다", () => {
    // Given
    const persistedReadAt = new Date(READ_AT);
    const cheer = createCheer(persistedReadAt);

    // When
    persistedReadAt.setUTCFullYear(2000);
    const changed = cheer.markRead(new Date("2027-01-05T14:00:00.000Z"));

    // Then
    expect(changed).toBe(false);
    expect(cheer.readAt).toEqual(READ_AT);
  });

  it("수신자만 소유자로 판정하며 읽음 상태와 무관하게 유지한다", () => {
    // Given
    const cheer = createCheer();

    // When
    cheer.markRead(READ_AT);

    // Then
    expect(cheer.isReceivedBy("receiver")).toBe(true);
    expect(cheer.isReceivedBy("sender")).toBe(false);
    expect(cheer.isReceivedBy("stranger")).toBe(false);
  });
});
