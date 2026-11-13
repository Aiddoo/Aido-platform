import type { StorePeriodType, SubscriptionPlanType } from "@aido/api/vocabulary";

import type {
  AdminNoticeUser,
  SubscriptionNotice,
  SubscriptionNoticePremium,
  SubscriptionNoticePrice,
} from "../../application/read-models/admin-notice.read-model.js";
import type { SubscriptionNoticeEvent } from "../../domain/admin-notices.constants.js";
import {
  daysUntil,
  type DiscordEmbed,
  type DiscordEmbedField,
  field,
  formatCode,
  formatCountry,
  formatKst,
  formatKstWithRelative,
  formatMoney,
  formatTransactionId,
} from "./discord-notice-format.mapper.js";
import { displayNameOf, renderUserBlock } from "./discord-user-block.mapper.js";

/**
 * 색은 돈의 흐름으로 고정한다. 들어온 돈(초록), 잃은·잃을 위험의 돈(빨강), 해지 예고(노랑), 정보(파랑).
 * 샌드박스도 같은 색이고 제목 배지·환경 칸으로 구분한다.
 */
const TONE_COLORS = {
  revenue: 0x57f287,
  loss: 0xed4245,
  churn: 0xfee75c,
  info: 0x5865f2,
} as const;

type Tone = keyof typeof TONE_COLORS;

interface EventDisplay {
  readonly emoji: string;
  readonly title: string;
  readonly tone: Tone;
  /** 본문 한 줄 */
  readonly summary: string;
  /** 기간 끝(expiresAt) 칸 이름. 이벤트마다 그 시각의 의미가 다르다. */
  readonly periodEndLabel: string;
}

const EVENT_DISPLAY: Record<SubscriptionNoticeEvent, EventDisplay> = {
  purchased: {
    emoji: "🎉",
    title: "새 구독",
    tone: "revenue",
    summary: "구독을 시작했습니다.",
    periodEndLabel: "다음 갱신",
  },
  one_time_purchased: {
    emoji: "🛒",
    title: "일회성 구매",
    tone: "revenue",
    summary: "일회성 상품을 샀습니다.",
    periodEndLabel: "기간 끝",
  },
  trial_started: {
    emoji: "🌱",
    title: "무료 체험 시작",
    tone: "info",
    summary: "무료 체험을 시작했습니다. 체험이 끝나면 첫 결제가 됩니다.",
    periodEndLabel: "체험 끝 (첫 결제)",
  },
  trial_converted: {
    emoji: "💰",
    title: "체험 → 유료 전환",
    tone: "revenue",
    summary: "체험이 끝나 첫 결제가 됐습니다.",
    periodEndLabel: "다음 갱신",
  },
  renewed: {
    emoji: "🔄",
    title: "구독 갱신",
    tone: "revenue",
    summary: "구독이 갱신돼 결제됐습니다.",
    periodEndLabel: "다음 갱신",
  },
  cancellation_scheduled: {
    emoji: "🚪",
    title: "해지 예약",
    tone: "churn",
    summary: "자동 갱신을 껐습니다. 기간 끝까지 이용합니다.",
    periodEndLabel: "이용 종료",
  },
  trial_cancelled: {
    emoji: "⏸️",
    title: "체험 해지 예약",
    tone: "churn",
    summary: "체험 중 자동 갱신을 껐습니다. 체험 끝에 결제되지 않습니다.",
    periodEndLabel: "체험 끝",
  },
  uncancelled: {
    emoji: "✅",
    title: "해지 취소",
    tone: "info",
    summary: "해지를 취소해 자동 갱신이 다시 켜졌습니다.",
    periodEndLabel: "다음 갱신",
  },
  expired: {
    emoji: "⌛",
    title: "구독 만료",
    tone: "loss",
    summary: "구독이 끝났습니다.",
    periodEndLabel: "만료 시각",
  },
  trial_expired: {
    emoji: "📉",
    title: "체험 종료 (전환 안 됨)",
    tone: "loss",
    summary: "체험이 유료로 바뀌지 않고 끝났습니다.",
    periodEndLabel: "만료 시각",
  },
  billing_issue: {
    emoji: "⚠️",
    title: "결제 문제",
    tone: "loss",
    summary: "갱신 결제에 실패했습니다. 스토어가 결제를 다시 시도합니다.",
    periodEndLabel: "기간 끝",
  },
  refunded: {
    emoji: "💸",
    title: "환불",
    tone: "loss",
    summary: "스토어가 환불했습니다. 이 구독의 프리미엄은 바로 끝납니다.",
    periodEndLabel: "원래 기간 끝",
  },
  product_change_scheduled: {
    emoji: "🔀",
    title: "상품 변경 예약",
    tone: "info",
    summary: "다음 갱신부터 다른 상품으로 바뀝니다.",
    periodEndLabel: "변경 적용 (다음 갱신)",
  },
  transferred: {
    emoji: "🔁",
    title: "구독 이전",
    tone: "info",
    summary: "다른 계정의 구매가 이 계정으로 옮겨졌습니다.",
    periodEndLabel: "기간 끝",
  },
  extended: {
    emoji: "⏳",
    title: "구독 연장",
    tone: "info",
    summary: "스토어가 구독 기간을 늘렸습니다.",
    periodEndLabel: "다음 갱신",
  },
};

const STORE_LABELS: Record<NonNullable<SubscriptionNotice["store"]>, string> = {
  APP_STORE: "🍎 App Store",
  MAC_APP_STORE: "🍎 Mac App Store",
  PLAY_STORE: "🤖 Google Play",
  STRIPE: "🌐 Stripe",
  WEB_BILLING: "🌐 RevenueCat Web",
  AMAZON: "📦 Amazon",
  PROMOTIONAL: "🎁 프로모션",
};

const PLAN_LABELS: Record<SubscriptionPlanType, string> = {
  ANNUAL: "연간",
  MONTHLY: "월간",
};

const PERIOD_KIND_LABELS: Record<StorePeriodType, string> = {
  NORMAL: "일반",
  TRIAL: "무료 체험",
  INTRO: "첫 구매 할인",
  PROMOTIONAL: "프로모션",
  PREPAID: "선불",
};

/** 공급자 사유 코드(ACL이 옮긴 billing 어휘)를 운영자 말로 바꾼다. 원문 코드는 괄호로 남겨 검색에 쓴다. */
const END_REASON_LABELS: Record<NonNullable<SubscriptionNotice["endReason"]>, string> = {
  UNSUBSCRIBE: "사용자가 해지",
  BILLING_ERROR: "결제 실패",
  DEVELOPER_INITIATED: "개발자가 취소",
  PRICE_INCREASE: "가격 인상에 동의하지 않음",
  CUSTOMER_SUPPORT: "스토어 고객지원 환불",
  SUBSCRIPTION_PAUSED: "구독 일시정지",
  UNKNOWN: "알 수 없음",
};

const ENVIRONMENT_BADGES: Record<NonNullable<SubscriptionNotice["environment"]>, string> = {
  PRODUCTION: "[운영]",
  SANDBOX: "[샌드박스]",
};

const ENVIRONMENT_LABELS: Record<NonNullable<SubscriptionNotice["environment"]>, string> = {
  PRODUCTION: "운영",
  SANDBOX: "🧪 샌드박스 (테스트 결제 · 매출 아님)",
};

/** 사유 칸을 늘 보여 줄 이벤트. 사유가 없으면 —로 비었음을 보인다. */
const REASON_EVENTS: ReadonlySet<SubscriptionNoticeEvent> = new Set([
  "cancellation_scheduled",
  "trial_cancelled",
  "expired",
  "trial_expired",
  "refunded",
]);

const TRANSFER_IDS_SHOWN = 3;

function planLabel(planType: SubscriptionPlanType | undefined): string | undefined {
  return planType == null ? undefined : PLAN_LABELS[planType];
}

/** 현지 통화 금액과 USD 환산을 둘 다 적는다. 둘 중 하나만 있으면 있는 값만 적는다. */
function formatNoticePrice(price: SubscriptionNoticePrice): string | undefined {
  const local =
    price.amount != null && price.currency != null
      ? formatMoney(price.amount, price.currency)
      : undefined;
  const usd = price.usd == null ? undefined : formatMoney(price.usd, "USD");
  if (local != null && usd != null && price.currency !== "USD") {
    return `${local} · ${usd}`;
  }
  return local ?? usd;
}

function premiumLabel(premium: SubscriptionNoticePremium | undefined, at: string): string {
  if (premium == null) {
    return "확인 안 됨";
  }
  const banked = premium.bankedDays > 0 ? ` · 초대 보상 ${premium.bankedDays}일 대기` : "";
  if (premium.source === "STORE") {
    return `스토어 구독${premium.isTrial ? " (체험 중)" : ""}${banked}`;
  }
  if (premium.source === "GRANT") {
    const remaining = premium.periodEndsAt == null ? null : daysUntil(premium.periodEndsAt, at);
    const left = remaining == null ? "" : ` · ${remaining}일 남음`;
    const after = premium.bankedDays > 0 ? ` · 이어서 ${premium.bankedDays}일` : "";
    return `초대 보상${left}${after}`;
  }
  return "무료";
}

function reasonLabel(reason: SubscriptionNotice["endReason"]): string | undefined {
  return reason == null ? undefined : `${END_REASON_LABELS[reason]} (${reason})`;
}

function idsLabel(ids: readonly string[]): string {
  if (ids.length === 0) {
    return "없음";
  }
  const shown = ids.slice(0, TRANSFER_IDS_SHOWN).map((id) => `\`${id}\``);
  const rest = ids.length - TRANSFER_IDS_SHOWN;
  return rest > 0 ? `${shown.join(", ")} 외 ${rest}개` : shown.join(", ");
}

function appLabel(subscription: SubscriptionNotice): string | undefined {
  const version = subscription.appVersion == null ? undefined : `v${subscription.appVersion}`;
  const label = [version, subscription.deviceModel].filter((part) => part != null).join(" · ");
  return label === "" ? undefined : label;
}

function paymentBlock(
  subscription: SubscriptionNotice,
  display: EventDisplay,
): DiscordEmbedField[] {
  const fields: DiscordEmbedField[] = [
    field("요금제", planLabel(subscription.planType)),
    field("상품", formatCode(subscription.productId)),
    field("스토어", subscription.store == null ? undefined : STORE_LABELS[subscription.store]),
    field("금액", formatNoticePrice(subscription.price)),
    field(
      "기간 유형",
      subscription.periodKind == null ? undefined : PERIOD_KIND_LABELS[subscription.periodKind],
    ),
    field(
      "환경",
      subscription.environment == null ? undefined : ENVIRONMENT_LABELS[subscription.environment],
    ),
    field(display.periodEndLabel, formatKstWithRelative(subscription.expiresAt)),
    field("구매 시각", formatKst(subscription.purchasedAt)),
  ];
  if (subscription.event === "billing_issue") {
    fields.push(field("결제 재시도 끝", formatKstWithRelative(subscription.gracePeriodEndsAt)));
  }
  if (subscription.isFirstPurchase != null) {
    fields.push(field("첫 구매", subscription.isFirstPurchase ? "예" : "아니오"));
  }
  if (REASON_EVENTS.has(subscription.event) || subscription.endReason != null) {
    fields.push(field("사유", reasonLabel(subscription.endReason), false));
  }
  if (subscription.event === "product_change_scheduled") {
    const next = [planLabel(subscription.newPlanType), formatCode(subscription.newProductId)]
      .filter((part) => part != null)
      .join(" · ");
    fields.push(field("바뀔 상품", next, false));
  }
  if (subscription.transfer != null) {
    fields.push(
      field(
        "이전",
        `보낸 계정 ${idsLabel(subscription.transfer.from)} → 받은 계정 ${idsLabel(subscription.transfer.to)}`,
        false,
      ),
    );
  }
  fields.push(
    field("앱·기기", appLabel(subscription)),
    field("원거래 ID", formatTransactionId(subscription.storeSubscriptionId)),
  );
  return fields;
}

/**
 * 결제 채널 구독 이벤트 embed. 사용자 블록(가입 알림과 같음) → 국가·프리미엄·공급자 링크 → 결제 블록 순이다.
 */
export function renderSubscriptionNoticeEmbed(
  user: AdminNoticeUser,
  subscription: SubscriptionNotice,
  at: string,
): DiscordEmbed {
  const display = EVENT_DISPLAY[subscription.event];
  const badge =
    subscription.environment == null ? "" : `${ENVIRONMENT_BADGES[subscription.environment]} `;
  const sandboxLine =
    subscription.environment === "SANDBOX" ? "\n🧪 샌드박스 결제라 매출이 아닙니다." : "";

  return {
    title: `${badge}${display.emoji} ${display.title}`,
    description: `**${displayNameOf(user)}** 님 — ${display.summary}${sandboxLine}`,
    color: TONE_COLORS[display.tone],
    fields: [
      ...renderUserBlock(user, at),
      field("국가", formatCountry(subscription.countryCode)),
      field("프리미엄", premiumLabel(subscription.premium, at)),
      field(
        "RevenueCat",
        subscription.customerUrl == null ? undefined : `[고객 화면](${subscription.customerUrl})`,
      ),
      ...paymentBlock(subscription, display),
    ],
    ...(subscription.customerUrl != null && { url: subscription.customerUrl }),
    timestamp: at,
  };
}
