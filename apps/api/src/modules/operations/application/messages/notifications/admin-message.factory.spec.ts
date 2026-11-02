import type { AdminNotification } from "../../read-models/notifications/admin-notification.read-model.js";
import type { SubscriptionAlertInput } from "../../types/notifications/subscription-alert.input.js";
import type { UserRegisteredEventPayload } from "../../types/notifications/user-registered.payload.js";
import {
  buildSubscriptionEventMessage,
  buildUserRegisteredMessage,
} from "./admin-message.factory.js";

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
  it("1.14.0 앱 가입은 기기·앱 버전·언어 정보를 결제 알림과 같은 격자로 표시한다", () => {
    // Given
    const payload: UserRegisteredEventPayload = {
      ...basePayload,
      name: "아이도",
      devicePlatform: "IOS",
      osVersion: "18.1",
      deviceModel: "iPhone 16 Pro",
      appVersion: "1.14.0",
      appBuild: "123",
      locale: "ko",
      timezone: "Asia/Seoul",
    };

    // When
    const message = buildUserRegisteredMessage(payload);

    // Then
    expect(message.title).toBe("👋 새로운 회원가입");
    expect(message.body).toBe("**아이도** 님이 가입했습니다.");
    expect(message.fields).toEqual([
      { name: "이메일", value: "user@example.com", inline: true },
      { name: "이름", value: "아이도", inline: true },
      { name: "가입 방식", value: "Apple", inline: true },
      { name: "기기", value: "🍎 iOS 18.1 · iPhone 16 Pro", inline: true },
      { name: "앱 버전", value: "v1.14.0 (123)", inline: true },
      { name: "언어·시간대", value: "ko · Asia/Seoul", inline: true },
      { name: "사용자 ID", value: "user-1", inline: false },
      { name: "가입 시각", value: "<t:1783728000:f>", inline: false },
    ]);
  });

  it("Android 기기는 OS 버전과 모델을 함께 표시한다", () => {
    // Given
    const payload: UserRegisteredEventPayload = {
      ...basePayload,
      provider: "google",
      devicePlatform: "ANDROID",
      osVersion: "15",
      deviceModel: "Pixel 9",
    };

    // When
    const message = buildUserRegisteredMessage(payload);

    // Then
    expect(fieldValue(message, "기기")).toBe("🤖 Android 15 · Pixel 9");
  });

  it("빌드 번호가 없으면 앱 버전만 표시한다", () => {
    // Given
    const payload: UserRegisteredEventPayload = { ...basePayload, appVersion: "1.14.0" };

    // When
    const message = buildUserRegisteredMessage(payload);

    // Then
    expect(fieldValue(message, "앱 버전")).toBe("v1.14.0");
  });

  it("OS 버전을 보내지 않는 구 앱은 플랫폼·모델·앱 버전만 표시한다", () => {
    // Given
    const payload: UserRegisteredEventPayload = {
      ...basePayload,
      devicePlatform: "ANDROID",
      deviceModel: "Galaxy S24",
      appVersion: "1.13.1",
    };

    // When
    const message = buildUserRegisteredMessage(payload);

    // Then
    expect(fieldValue(message, "기기")).toBe("🤖 Android · Galaxy S24");
    expect(fieldValue(message, "앱 버전")).toBe("v1.13.1");
    expect(fieldValue(message, "언어·시간대")).toBe("—");
  });

  it("기기 정보가 없으면 가입 방식으로 추측하지 않고 —로 표시한다", () => {
    // Given
    const payload: UserRegisteredEventPayload = { ...basePayload, provider: "google" };

    // When
    const message = buildUserRegisteredMessage(payload);

    // Then
    expect(fieldValue(message, "기기")).toBe("—");
    expect(fieldValue(message, "앱 버전")).toBe("—");
    expect(fieldValue(message, "언어·시간대")).toBe("—");
  });

  it("이름이 없으면 이메일 앞부분을 이름으로 쓴다", () => {
    // Given

    // When
    const message = buildUserRegisteredMessage(basePayload);

    // Then
    expect(message.body).toBe("**user** 님이 가입했습니다.");
    expect(fieldValue(message, "이름")).toBe("user");
  });
});

describe("buildSubscriptionEventMessage — 결제 알림", () => {
  const purchase: SubscriptionAlertInput = {
    userId: "user-1",
    email: "matthew@example.com",
    name: "매튜",
    eventType: "INITIAL_PURCHASE",
    productId: "aido_premium_monthly",
    store: "APP_STORE",
    environment: "PRODUCTION",
    transactionId: "2000000123456789",
    purchasedAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    priceUsd: 2.99,
    priceInPurchasedCurrency: 3900,
    purchasedCurrency: "KRW",
    countryCode: "KR",
    periodType: "NORMAL",
  };

  function subscriptionField(message: AdminNotification, name: string) {
    return message.fields?.find((field) => field.name === name)?.value;
  }

  it("운영 iOS 신규 구매는 모든 공통 필드를 정해진 순서로 표시한다", () => {
    const message = buildSubscriptionEventMessage(purchase);

    expect(message.title).toBe("🎉 새로운 구독 구매");
    expect(message.body).toBe("**매튜** 님의 구독 이벤트 (INITIAL_PURCHASE)");
    expect(message.color).toBe(0x57f287);
    expect(message.fields).toEqual([
      { name: "이메일", value: "matthew@example.com", inline: true },
      { name: "이름", value: "매튜", inline: true },
      { name: "상품", value: "월간 · aido_premium_monthly", inline: true },
      { name: "스토어", value: "Apple App Store", inline: true },
      { name: "기기", value: "🍎 iOS", inline: true },
      { name: "금액", value: "₩3,900 (≈ $2.99)", inline: true },
      { name: "환경", value: "운영", inline: true },
      { name: "구독 유형", value: "일반", inline: true },
      { name: "자동 갱신", value: "켜짐", inline: true },
      { name: "국가", value: "🇰🇷 KR", inline: true },
      { name: "구매일", value: "<t:1793491200:f>", inline: true },
      { name: "만료일", value: "<t:1796083200:f>", inline: true },
      { name: "트랜잭션", value: "`2000000123456789`", inline: false },
      { name: "사용자 ID", value: "user-1", inline: false },
    ]);
  });

  it("샌드박스 결제는 제목 접두어·회색·환경 필드로 매출이 아님을 표시한다", () => {
    const message = buildSubscriptionEventMessage({ ...purchase, environment: "SANDBOX" });

    expect(message.title).toBe("[샌드박스] 🎉 새로운 구독 구매");
    expect(message.color).toBe(0x747f8d);
    expect(subscriptionField(message, "환경")).toBe("🧪 샌드박스 (테스트 결제 · 매출 아님)");
  });

  it("선택 정보가 없어도 같은 필드를 유지하고 값은 —로 표시하며 이름은 이메일 앞부분으로 대체한다", () => {
    const message = buildSubscriptionEventMessage({
      userId: "user-2",
      email: "renewer@example.com",
      eventType: "EXPIRATION",
      productId: "custom_product",
    });

    expect(message.body).toBe("**renewer** 님의 구독 이벤트 (EXPIRATION)");
    expect(message.fields?.map((field) => field.name)).toEqual([
      "이메일",
      "이름",
      "상품",
      "스토어",
      "기기",
      "금액",
      "환경",
      "구독 유형",
      "자동 갱신",
      "국가",
      "구매일",
      "만료일",
      "만료 사유",
      "트랜잭션",
      "사용자 ID",
    ]);
    expect(subscriptionField(message, "이름")).toBe("renewer");
    expect(subscriptionField(message, "상품")).toBe("custom_product");
    expect(subscriptionField(message, "금액")).toBe("—");
    expect(subscriptionField(message, "환경")).toBe("—");
    expect(subscriptionField(message, "만료 사유")).toBe("—");
    expect(subscriptionField(message, "자동 갱신")).toBe("꺼짐");
  });

  it("Android 갱신은 Play Store·Android와 USD 결제 금액을 표시한다", () => {
    const message = buildSubscriptionEventMessage({
      ...purchase,
      eventType: "RENEWAL",
      store: "PLAY_STORE",
      priceInPurchasedCurrency: 2.99,
      purchasedCurrency: "USD",
      transactionId: "GPA.3345-1122-9988-12345..0",
      deviceModel: "Pixel 9",
      appVersion: "1.4.0",
    });

    expect(message.title).toBe("🔄 구독 갱신");
    expect(subscriptionField(message, "스토어")).toBe("Google Play Store");
    expect(subscriptionField(message, "기기")).toBe("🤖 Android · Pixel 9 · v1.4.0");
    expect(subscriptionField(message, "금액")).toBe("$2.99");
    expect(subscriptionField(message, "트랜잭션")).toBe("`GPA.3345…345..0`");
  });

  it("CUSTOMER_SUPPORT 취소는 환불로 표시하고 사유를 한국어와 원문으로 함께 적는다", () => {
    const message = buildSubscriptionEventMessage({
      ...purchase,
      eventType: "CANCELLATION",
      cancelReason: "CUSTOMER_SUPPORT",
    });

    expect(message.title).toBe("↩️ 구독 환불");
    expect(message.color).toBe(0xe91e63);
    expect(subscriptionField(message, "취소 사유")).toBe("고객지원 환불 (CUSTOMER_SUPPORT)");
    expect(subscriptionField(message, "자동 갱신")).toBe("꺼짐");
  });

  it("일반 해지는 구독 취소로 표시한다", () => {
    const message = buildSubscriptionEventMessage({
      ...purchase,
      eventType: "CANCELLATION",
      cancelReason: "UNSUBSCRIBE",
    });

    expect(message.title).toBe("❌ 구독 취소");
    expect(subscriptionField(message, "취소 사유")).toBe("사용자 해지 (UNSUBSCRIBE)");
  });

  it("결제 문제는 경고 색과 재시도 중인 자동 갱신 상태를 표시한다", () => {
    const message = buildSubscriptionEventMessage({ ...purchase, eventType: "BILLING_ISSUE" });

    expect(message.title).toBe("⚠️ 결제 문제 감지");
    expect(message.color).toBe(0xf1c40f);
    expect(subscriptionField(message, "자동 갱신")).toBe("켜짐 (결제 재시도 중)");
    expect(subscriptionField(message, "취소 사유")).toBeUndefined();
  });

  it.each([
    ["UNCANCELLATION", "✅ 구독 취소 철회"],
    ["PRODUCT_CHANGE", "🔀 구독 상품 변경"],
    ["TRANSFER", "🔁 구독 이전"],
    ["SUBSCRIPTION_EXTENDED", "⏳ 구독 연장"],
    ["NON_RENEWING_PURCHASE", "🛒 일회성 구매"],
    ["SUBSCRIPTION_PAUSED", "📋 구독 이벤트"],
  ])("%s 이벤트 제목은 %s 이다", (eventType, title) => {
    expect(buildSubscriptionEventMessage({ ...purchase, eventType }).title).toBe(title);
  });

  it("체험 구독과 연간 상품을 한국어 라벨로 표시한다", () => {
    const message = buildSubscriptionEventMessage({
      ...purchase,
      productId: "aido_premium_yearly",
      periodType: "TRIAL",
    });

    expect(subscriptionField(message, "상품")).toBe("연간 · aido_premium_yearly");
    expect(subscriptionField(message, "구독 유형")).toBe("무료 체험");
  });
});
