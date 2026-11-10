import type { AdminNoticeUser } from "../../application/read-models/admin-notice.read-model.js";
import { renderDiscordEmbed } from "./discord-embed.mapper.js";

const user: AdminNoticeUser = {
  userId: "user-1",
  email: "aido@example.com",
  nickname: "아이도",
  userTag: "AIDO2026",
  joinedAt: "2026-11-10T00:30:00.000Z",
  signupMethod: "KAKAO",
};

const AT = "2026-11-10T00:30:05.000Z";

describe("Discord 가입 알림 embed", () => {
  it("결제 알림과 같은 사용자 블록 뒤에 가입 기기·앱·언어를 둔다", () => {
    // Given / When
    const embed = renderDiscordEmbed(
      {
        type: "user_registered",
        user,
        signup: {
          devicePlatform: "ANDROID",
          osVersion: "16",
          deviceModel: "SM-S938N",
          appVersion: "1.15.0",
          appBuild: "412",
          locale: "ko-KR",
          timezone: "Asia/Seoul",
        },
      },
      AT,
    );

    // Then
    expect(embed).toEqual({
      title: "👋 새로운 회원가입",
      description: "**아이도** 님이 가입했습니다.",
      color: 0x57f287,
      fields: [
        { name: "닉네임", value: "아이도", inline: true },
        { name: "태그", value: "#AIDO2026", inline: true },
        { name: "가입 방식", value: "Kakao", inline: true },
        { name: "가입일", value: "2026-11-10 (D+0, 오늘 가입)", inline: true },
        { name: "이메일", value: "aido@example.com", inline: true },
        { name: "사용자 ID", value: "`user-1`", inline: true },
        { name: "기기", value: "🤖 Android 16 · SM-S938N", inline: true },
        { name: "앱 버전", value: "v1.15.0 (412)", inline: true },
        { name: "언어·시간대", value: "ko-KR · Asia/Seoul", inline: true },
      ],
      timestamp: AT,
    });
  });

  it("가입·결제 알림의 사용자 블록은 같은 이름·같은 순서·같은 값이다", () => {
    // Given
    const signup = renderDiscordEmbed({ type: "user_registered", user, signup: {} }, AT);

    // When
    const payment = renderDiscordEmbed(
      {
        type: "subscription_event",
        user,
        subscription: { event: "purchased", price: {} },
      },
      AT,
    );

    // Then
    expect(payment.fields.slice(0, 6)).toEqual(signup.fields.slice(0, 6));
  });

  it("기기 정보를 보내지 않은 앱은 가입 방식으로 추측하지 않고 —로 둔다", () => {
    // Given / When
    const embed = renderDiscordEmbed({ type: "user_registered", user, signup: {} }, AT);

    // Then
    expect(embed.fields.slice(6)).toEqual([
      { name: "기기", value: "—", inline: true },
      { name: "앱 버전", value: "—", inline: true },
      { name: "언어·시간대", value: "—", inline: true },
    ]);
  });
});
