import type {
  AdminNotice,
  AdminNoticeUser,
  SubscriptionNotice,
} from "../../application/read-models/admin-notice.read-model.js";
import type { SubscriptionNoticeEvent } from "../../domain/admin-notices.constants.js";
import { renderDiscordEmbed } from "./discord-embed.mapper.js";
import type { DiscordEmbed } from "./discord-notice-format.mapper.js";

/** 2026-11-10 10:00 KST */
const AT = "2026-11-10T01:00:00.000Z";
const CUSTOMER_URL = "https://app.revenuecat.com/projects/p1/customers/user-1";

const GREEN = 0x57f287;
const RED = 0xed4245;
const YELLOW = 0xfee75c;
const BLUE = 0x5865f2;

const user: AdminNoticeUser = {
  userId: "user-1",
  email: "matthew@example.com",
  nickname: "매튜",
  userTag: "MATT2025",
  joinedAt: "2026-10-01T03:00:00.000Z",
  signupMethod: "APPLE",
};

const subscription: SubscriptionNotice = {
  event: "renewed",
  environment: "PRODUCTION",
  store: "APP_STORE",
  productId: "com.aido.pro.yearly",
  planType: "ANNUAL",
  periodKind: "NORMAL",
  price: { amount: 39_000, currency: "KRW", usd: 27.99 },
  purchasedAt: "2026-11-10T00:59:00.000Z",
  expiresAt: "2027-11-10T00:59:00.000Z",
  countryCode: "KR",
  premium: {
    source: "STORE",
    periodEndsAt: "2027-11-10T00:59:00.000Z",
    bankedDays: 0,
    isTrial: false,
  },
  storeSubscriptionId: "2000000812345678",
  appVersion: "1.15.0",
  deviceModel: "iPhone17,1",
  customerUrl: CUSTOMER_URL,
};

function render(overrides: Partial<SubscriptionNotice> = {}, noticeUser = user): DiscordEmbed {
  const notice: AdminNotice = {
    type: "subscription_event",
    user: noticeUser,
    subscription: { ...subscription, ...overrides },
  };
  return renderDiscordEmbed(notice, AT);
}

function valueOf(embed: DiscordEmbed, name: string): string | undefined {
  return embed.fields.find((field) => field.name === name)?.value;
}

function relative(iso: string): string {
  return `<t:${Date.parse(iso) / 1000}:R>`;
}

describe("Discord 결제 알림 embed", () => {
  describe("이벤트마다 제목 이모지·색을 고정하고 돈의 흐름으로 색을 나눈다", () => {
    it.each<readonly [SubscriptionNoticeEvent, string, number]>([
      ["purchased", "🎉 새 구독", GREEN],
      ["one_time_purchased", "🛒 일회성 구매", GREEN],
      ["trial_converted", "💰 체험 → 유료 전환", GREEN],
      ["renewed", "🔄 구독 갱신", GREEN],
      ["trial_started", "🌱 무료 체험 시작", BLUE],
      ["uncancelled", "✅ 해지 취소", BLUE],
      ["product_change_scheduled", "🔀 상품 변경 예약", BLUE],
      ["transferred", "🔁 구독 이전", BLUE],
      ["extended", "⏳ 구독 연장", BLUE],
      ["cancellation_scheduled", "🚪 해지 예약", YELLOW],
      ["trial_cancelled", "⏸️ 체험 해지 예약", YELLOW],
      ["billing_issue", "⚠️ 결제 문제", RED],
      ["refunded", "💸 환불", RED],
      ["expired", "⌛ 구독 만료", RED],
      ["trial_expired", "📉 체험 종료 (전환 안 됨)", RED],
    ])("%s → [운영] %s", (event, title, color) => {
      // Given / When
      const embed = render({ event });

      // Then
      expect(embed.title).toBe(`[운영] ${title}`);
      expect(embed.color).toBe(color);
    });
  });

  it("운영 갱신은 사용자 블록 → 국가·프리미엄·고객 링크 → 결제 블록 순으로 그린다", () => {
    // Given / When
    const embed = render();

    // Then
    expect(embed).toEqual({
      title: "[운영] 🔄 구독 갱신",
      description: "**매튜** 님 — 구독이 갱신돼 결제됐습니다.",
      color: GREEN,
      fields: [
        { name: "닉네임", value: "매튜", inline: true },
        { name: "태그", value: "#MATT2025", inline: true },
        { name: "가입 방식", value: "Apple", inline: true },
        { name: "가입일", value: "2026-10-01 (D+40)", inline: true },
        { name: "이메일", value: "matthew@example.com", inline: true },
        { name: "사용자 ID", value: "`user-1`", inline: true },
        { name: "국가", value: "🇰🇷 대한민국 (KR)", inline: true },
        { name: "프리미엄", value: "스토어 구독", inline: true },
        { name: "RevenueCat", value: `[고객 화면](${CUSTOMER_URL})`, inline: true },
        { name: "요금제", value: "연간", inline: true },
        { name: "상품", value: "`com.aido.pro.yearly`", inline: true },
        { name: "스토어", value: "🍎 App Store", inline: true },
        { name: "금액", value: "₩39,000 · US$27.99", inline: true },
        { name: "기간 유형", value: "일반", inline: true },
        { name: "환경", value: "운영", inline: true },
        {
          name: "다음 갱신",
          value: `2027-11-10 09:59 KST · ${relative("2027-11-10T00:59:00.000Z")}`,
          inline: true,
        },
        { name: "구매 시각", value: "2026-11-10 09:59 KST", inline: true },
        { name: "앱·기기", value: "v1.15.0 · iPhone17,1", inline: true },
        { name: "원거래 ID", value: "`2000000812345678`", inline: true },
      ],
      url: CUSTOMER_URL,
      timestamp: AT,
    });
  });

  it("샌드박스는 같은 색에 [샌드박스] 배지와 매출 아님 안내를 붙인다", () => {
    // Given / When
    const embed = render({ event: "purchased", environment: "SANDBOX" });

    // Then
    expect(embed.title).toBe("[샌드박스] 🎉 새 구독");
    expect(embed.color).toBe(GREEN);
    expect(embed.description).toContain("샌드박스 결제라 매출이 아닙니다");
    expect(valueOf(embed, "환경")).toBe("🧪 샌드박스 (테스트 결제 · 매출 아님)");
  });

  it("환경을 모르면 배지 없이 보내고 환경 칸은 —로 둔다", () => {
    // Given / When
    const embed = render({ environment: undefined });

    // Then
    expect(embed.title).toBe("🔄 구독 갱신");
    expect(valueOf(embed, "환경")).toBe("—");
  });

  describe("해지·만료 사유는 운영자 말로 바꾸고 원문 코드를 괄호로 남긴다", () => {
    it.each([
      ["UNSUBSCRIBE", "사용자가 해지 (UNSUBSCRIBE)"],
      ["BILLING_ERROR", "결제 실패 (BILLING_ERROR)"],
      ["DEVELOPER_INITIATED", "개발자가 취소 (DEVELOPER_INITIATED)"],
      ["PRICE_INCREASE", "가격 인상에 동의하지 않음 (PRICE_INCREASE)"],
      ["CUSTOMER_SUPPORT", "스토어 고객지원 환불 (CUSTOMER_SUPPORT)"],
      ["SUBSCRIPTION_PAUSED", "구독 일시정지 (SUBSCRIPTION_PAUSED)"],
      ["UNKNOWN", "알 수 없음 (UNKNOWN)"],
    ] as const)("%s → %s", (endReason, label) => {
      // Given / When
      const embed = render({ event: "expired", endReason });

      // Then
      expect(embed.fields).toContainEqual({ name: "사유", value: label, inline: false });
    });

    it("해지 예약에 사유가 없으면 사유 칸을 —로 보여 빠졌음을 알린다", () => {
      // Given / When
      const embed = render({ event: "cancellation_scheduled" });

      // Then
      expect(valueOf(embed, "사유")).toBe("—");
      expect(valueOf(embed, "이용 종료")).toContain("2027-11-10 09:59 KST");
    });

    it("갱신처럼 사유가 없는 이벤트에는 사유 칸을 만들지 않는다", () => {
      expect(valueOf(render(), "사유")).toBeUndefined();
    });
  });

  describe("금액은 현지 통화와 USD 환산을 웹훅 값 그대로 함께 적는다", () => {
    it.each([
      ["현지 통화와 USD", { amount: 3900, currency: "KRW", usd: 2.99 }, "₩3,900 · US$2.99"],
      ["USD 결제", { amount: 2.99, currency: "USD", usd: 2.99 }, "US$2.99"],
      ["USD 환산만", { usd: 2.99 }, "US$2.99"],
      ["현지 통화만", { amount: 1200, currency: "JPY" }, "JP¥1,200"],
      [
        "환불의 음수 금액",
        { amount: -39_000, currency: "KRW", usd: -27.99 },
        "-₩39,000 · -US$27.99",
      ],
      ["금액 없음", {}, "—"],
    ] as const)("%s → %s", (_label, price, expected) => {
      expect(valueOf(render({ price }), "금액")).toBe(expected);
    });
  });

  describe("프리미엄 출처와 초대 보상 일수", () => {
    it.each([
      ["스토어 체험", { source: "STORE", bankedDays: 0, isTrial: true }, "스토어 구독 (체험 중)"],
      [
        "스토어 뒤 보상 대기",
        { source: "STORE", bankedDays: 7, isTrial: false },
        "스토어 구독 · 초대 보상 7일 대기",
      ],
      [
        "보상 기간 진행 중",
        {
          source: "GRANT",
          periodEndsAt: "2026-11-15T01:00:00.000Z",
          bankedDays: 3,
          isTrial: false,
        },
        "초대 보상 · 5일 남음 · 이어서 3일",
      ],
      ["프리미엄 아님", { source: null, bankedDays: 0, isTrial: false }, "무료"],
    ] as const)("%s → %s", (_label, premium, expected) => {
      expect(valueOf(render({ premium }), "프리미엄")).toBe(expected);
    });

    it("구독 행을 바꾸지 않아 상태를 모르면 확인 안 됨으로 적는다", () => {
      expect(valueOf(render({ premium: undefined }), "프리미엄")).toBe("확인 안 됨");
    });
  });

  it("결제 문제는 기간 끝과 스토어 결제 재시도 끝을 KST로 적는다", () => {
    // Given / When
    const embed = render({
      event: "billing_issue",
      expiresAt: "2026-11-10T00:00:00.000Z",
      gracePeriodEndsAt: "2026-11-26T00:00:00.000Z",
    });

    // Then
    expect(valueOf(embed, "기간 끝")).toBe(
      `2026-11-10 09:00 KST · ${relative("2026-11-10T00:00:00.000Z")}`,
    );
    expect(valueOf(embed, "결제 재시도 끝")).toBe(
      `2026-11-26 09:00 KST · ${relative("2026-11-26T00:00:00.000Z")}`,
    );
  });

  it("체험 시작은 기간 끝을 첫 결제 시각으로 적는다", () => {
    // Given / When
    const embed = render({ event: "trial_started", periodKind: "TRIAL", price: { usd: 0 } });

    // Then
    expect(valueOf(embed, "체험 끝 (첫 결제)")).toContain("2027-11-10 09:59 KST");
    expect(valueOf(embed, "기간 유형")).toBe("무료 체험");
  });

  it("새 구독은 첫 스토어 구매인지 적는다", () => {
    expect(valueOf(render({ event: "purchased", isFirstPurchase: true }), "첫 구매")).toBe("예");
  });

  it("상품 변경 예약은 바뀔 요금제와 상품을 적는다", () => {
    // Given / When
    const embed = render({
      event: "product_change_scheduled",
      newProductId: "com.aido.pro.monthly",
      newPlanType: "MONTHLY",
    });

    // Then
    expect(embed.fields).toContainEqual({
      name: "바뀔 상품",
      value: "월간 · `com.aido.pro.monthly`",
      inline: false,
    });
  });

  it("이전은 보낸·받은 계정을 셋까지 적고 나머지는 개수로 줄인다", () => {
    // Given / When
    const embed = render({
      event: "transferred",
      productId: undefined,
      transfer: { from: ["a", "b", "c", "d"], to: ["user-1"] },
    });

    // Then
    expect(valueOf(embed, "이전")).toBe("보낸 계정 `a`, `b`, `c` 외 1개 → 받은 계정 `user-1`");
    expect(valueOf(embed, "상품")).toBe("—");
  });

  it("닉네임·태그·가입 정보를 모르면 칸은 —로 두고 본문은 이메일 앞부분으로 부른다", () => {
    // Given / When
    const embed = render({}, { userId: "user-1", email: "fallback@example.com" });

    // Then
    expect(embed.description).toBe("**fallback** 님 — 구독이 갱신돼 결제됐습니다.");
    expect(embed.fields.slice(0, 4)).toEqual([
      { name: "닉네임", value: "—", inline: true },
      { name: "태그", value: "—", inline: true },
      { name: "가입 방식", value: "—", inline: true },
      { name: "가입일", value: "—", inline: true },
    ]);
  });

  it("고객 링크가 없으면 url을 만들지 않고 RevenueCat 칸은 —로 둔다", () => {
    // Given / When
    const embed = render({ customerUrl: undefined });

    // Then
    expect(embed.url).toBeUndefined();
    expect(valueOf(embed, "RevenueCat")).toBe("—");
  });

  it.each<SubscriptionNoticeEvent>([
    "purchased",
    "billing_issue",
    "product_change_scheduled",
    "transferred",
    "expired",
  ])("%s 알림도 Discord 한도(필드 25개·값 1~1024자) 안에 든다", (event) => {
    // Given / When
    const embed = render({
      event,
      isFirstPurchase: true,
      endReason: "UNKNOWN",
      gracePeriodEndsAt: "2026-11-26T00:00:00.000Z",
      newProductId: "x".repeat(2000),
      transfer: { from: ["a"], to: ["b"] },
    });

    // Then
    expect(embed.fields.length).toBeLessThanOrEqual(25);
    for (const field of embed.fields) {
      expect(field.value.length).toBeGreaterThan(0);
      expect(field.value.length).toBeLessThanOrEqual(1024);
    }
  });
});
