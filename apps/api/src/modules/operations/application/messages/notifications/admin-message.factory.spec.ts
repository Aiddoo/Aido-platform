import type { UserRegisteredEventPayload } from "../../types/notifications/user-registered.payload.js";
import { buildUserRegisteredMessage } from "./admin-message.factory.js";

const basePayload: UserRegisteredEventPayload = {
  userId: "user-1",
  email: "user@example.com",
  provider: "apple",
  registeredAt: "2026-07-11T00:00:00.000Z",
};

function fieldValue(message: ReturnType<typeof buildUserRegisteredMessage>, name: string) {
  return message.fields?.find((field) => field.name === name)?.value;
}

describe("buildUserRegisteredMessage — 회원가입 알림", () => {
  it("이름이 있으면 제목 줄과 닉네임 필드에 표시한다", () => {
    const message = buildUserRegisteredMessage({ ...basePayload, name: "아이도" });

    expect(message.body).toBe("**아이도**(user@example.com) 님이 가입했습니다.");
    expect(fieldValue(message, "닉네임")).toBe("아이도");
  });

  it("이름이 없으면 이메일만 표시한다", () => {
    const message = buildUserRegisteredMessage(basePayload);

    expect(message.body).toBe("**user@example.com** 님이 가입했습니다.");
    expect(fieldValue(message, "닉네임")).toBeUndefined();
  });

  it("플랫폼과 모델이 있으면 함께 표시한다", () => {
    const message = buildUserRegisteredMessage({
      ...basePayload,
      devicePlatform: "IOS",
      deviceModel: "iPhone 15 Pro",
    });

    expect(fieldValue(message, "기기")).toBe("🍎 iOS · iPhone 15 Pro");
  });

  it("플랫폼만 있으면 플랫폼만 표시한다", () => {
    const message = buildUserRegisteredMessage({ ...basePayload, devicePlatform: "ANDROID" });

    expect(fieldValue(message, "기기")).toBe("🤖 Android");
  });

  it("기기 정보가 없으면 가입 방식으로 추측하지 않고 확인 불가로 표시한다", () => {
    const message = buildUserRegisteredMessage({ ...basePayload, provider: "google" });

    expect(fieldValue(message, "기기")).toBe("확인 불가");
    expect(fieldValue(message, "기기 (추정)")).toBeUndefined();
  });
});
