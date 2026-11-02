import { sumBy } from "es-toolkit";

import { AdminNotificationMessage } from "../../../domain/value-objects/notifications/admin-notification-message.vo.js";
import type {
  AdminNotification,
  AdminNotificationField,
} from "../../read-models/notifications/admin-notification.read-model.js";
import type { SubscriptionAlertInput } from "../../types/notifications/subscription-alert.input.js";
import type { UserRegisteredEventPayload } from "../../types/notifications/user-registered.payload.js";
import { formatDate, formatPrice } from "./discord-format.js";
import {
  accountProviderLabel,
  DEVICE_PLATFORM_LABELS,
  PROVIDER_LABELS,
} from "./provider-labels.js";
import {
  AUTO_RENEW_LABELS,
  DEFAULT_META,
  DEVICE_LABELS,
  EVENT_META,
  PERIOD_TYPE_LABELS,
  PRODUCT_PERIOD_LABELS,
  REASON_LABELS,
  REFUND_CANCEL_REASON,
  REVENUECAT_EVENT_TO_INTERNAL,
  SANDBOX_COLOR,
  STORE_LABELS,
  type SubscriptionEventKey,
} from "./subscription-event-meta.js";

const SANDBOX_ENVIRONMENT_LABEL = "🧪 샌드박스 (테스트 결제 · 매출 아님)";
const EMPTY = "—";
const TRANSACTION_ID_MAX_LENGTH = 20;

/** 전일 가입 집계 (provider별 count + 총 사용자 수) */
export interface DailySignupSummary {
  readonly signupsByProvider: readonly { readonly provider: string; readonly count: number }[];
  readonly totalUsers: number;
  readonly reportDateStr: string;
}

/**
 * 회원가입 관리자 알림 메시지 조립.
 *
 * 결제 알림과 같은 필드 격자로 두고, 구 앱처럼 값이 없으면 "—"로 표시한다.
 */
export function buildUserRegisteredMessage(payload: UserRegisteredEventPayload): AdminNotification {
  const displayName = payload.name ?? emailLocalPart(payload.email);

  return createAdminNotification({
    title: "👋 새로운 회원가입",
    body: `**${displayName}** 님이 가입했습니다.`,
    color: 0x57f287,
    fields: [
      { name: "이메일", value: payload.email, inline: true },
      { name: "이름", value: displayName, inline: true },
      {
        name: "가입 방식",
        value: PROVIDER_LABELS[payload.provider] ?? payload.provider,
        inline: true,
      },
      { name: "기기", value: signupDeviceLabel(payload), inline: true },
      { name: "앱 버전", value: appVersionLabel(payload), inline: true },
      { name: "언어·시간대", value: localeLabel(payload), inline: true },
      { name: "사용자 ID", value: payload.userId, inline: false },
      { name: "가입 시각", value: formatDate(payload.registeredAt), inline: false },
    ],
  });
}

function signupDeviceLabel(payload: UserRegisteredEventPayload): string {
  const platform = payload.devicePlatform
    ? DEVICE_PLATFORM_LABELS[payload.devicePlatform]
    : undefined;
  const system = platform && payload.osVersion ? `${platform} ${payload.osVersion}` : platform;
  return [system, payload.deviceModel].filter(Boolean).join(" · ") || EMPTY;
}

function appVersionLabel(payload: UserRegisteredEventPayload): string {
  if (!payload.appVersion) {
    return EMPTY;
  }
  return payload.appBuild
    ? `v${payload.appVersion} (${payload.appBuild})`
    : `v${payload.appVersion}`;
}

function localeLabel(payload: UserRegisteredEventPayload): string {
  return [payload.locale, payload.timezone].filter(Boolean).join(" · ") || EMPTY;
}

/**
 * 구독 이벤트 관리자 알림 메시지 조립.
 *
 * 이벤트마다 같은 필드를 같은 순서로 두고, 값이 없으면 "—"로 표시한다.
 */
export function buildSubscriptionEventMessage(payload: SubscriptionAlertInput): AdminNotification {
  const eventKey = resolveEventKey(payload);
  const meta = eventKey ? EVENT_META[eventKey] : DEFAULT_META;
  const isSandbox = payload.environment === "SANDBOX";
  const displayName = payload.name ?? emailLocalPart(payload.email);

  const fields: AdminNotificationField[] = [
    { name: "이메일", value: payload.email, inline: true },
    { name: "이름", value: displayName, inline: true },
    { name: "상품", value: productLabel(payload.productId), inline: true },
    { name: "스토어", value: lookup(STORE_LABELS, payload.store), inline: true },
    { name: "기기", value: deviceLabel(payload), inline: true },
    { name: "금액", value: priceLabel(payload), inline: true },
    { name: "환경", value: environmentLabel(payload.environment), inline: true },
    { name: "구독 유형", value: lookup(PERIOD_TYPE_LABELS, payload.periodType), inline: true },
    {
      name: "자동 갱신",
      value: (eventKey ? AUTO_RENEW_LABELS[eventKey] : undefined) ?? EMPTY,
      inline: true,
    },
    { name: "국가", value: countryLabel(payload.countryCode), inline: true },
    { name: "구매일", value: dateLabel(payload.purchasedAt), inline: true },
    { name: "만료일", value: dateLabel(payload.expiresAt), inline: true },
  ];

  if (payload.eventType === "CANCELLATION") {
    fields.push({ name: "취소 사유", value: reasonLabel(payload.cancelReason), inline: false });
  }
  if (payload.eventType === "EXPIRATION") {
    fields.push({ name: "만료 사유", value: reasonLabel(payload.expirationReason), inline: false });
  }

  fields.push(
    { name: "트랜잭션", value: transactionLabel(payload.transactionId), inline: false },
    { name: "사용자 ID", value: payload.userId, inline: false },
  );
  if (payload.revenueCatCustomerUrl) {
    fields.push({ name: "RevenueCat", value: payload.revenueCatCustomerUrl, inline: false });
  }

  return createAdminNotification({
    title: `${isSandbox ? "[샌드박스] " : ""}${meta.emoji} ${meta.title}`,
    body: `**${displayName}** 님의 구독 이벤트 (${payload.eventType})`,
    color: isSandbox ? SANDBOX_COLOR : meta.color,
    fields,
  });
}

function resolveEventKey(payload: SubscriptionAlertInput): SubscriptionEventKey | undefined {
  if (payload.eventType === "CANCELLATION" && payload.cancelReason === REFUND_CANCEL_REASON) {
    return "subscription.refunded";
  }
  return REVENUECAT_EVENT_TO_INTERNAL[payload.eventType];
}

function lookup(labels: Partial<Record<string, string>>, key: string | undefined): string {
  if (key == null || key === "") {
    return EMPTY;
  }
  return labels[key] ?? key;
}

function emailLocalPart(email: string): string {
  const [localPart] = email.split("@");
  return localPart == null || localPart === "" ? email : localPart;
}

function productLabel(productId: string): string {
  const period = PRODUCT_PERIOD_LABELS.find(({ pattern }) => pattern.test(productId));
  return period ? `${period.label} · ${productId}` : productId;
}

function deviceLabel(payload: SubscriptionAlertInput): string {
  const platform = payload.store ? (DEVICE_LABELS[payload.store] ?? payload.store) : undefined;
  const appVersion = payload.appVersion ? `v${payload.appVersion}` : undefined;
  return [platform, payload.deviceModel, appVersion].filter(Boolean).join(" · ") || EMPTY;
}

function priceLabel(payload: SubscriptionAlertInput): string {
  const { priceInPurchasedCurrency, purchasedCurrency, priceUsd } = payload;
  if (priceInPurchasedCurrency != null && purchasedCurrency) {
    const purchased = formatPrice(priceInPurchasedCurrency, purchasedCurrency);
    if (purchasedCurrency === "USD" || priceUsd == null) {
      return purchased;
    }
    return `${purchased} (≈ ${formatPrice(priceUsd, "USD")})`;
  }
  if (priceUsd != null) {
    return formatPrice(priceUsd, "USD");
  }
  return EMPTY;
}

function environmentLabel(environment: SubscriptionAlertInput["environment"]): string {
  if (environment === "SANDBOX") {
    return SANDBOX_ENVIRONMENT_LABEL;
  }
  if (environment === "PRODUCTION") {
    return "운영";
  }
  return EMPTY;
}

function countryLabel(countryCode: string | undefined): string {
  if (countryCode == null || countryCode === "") {
    return EMPTY;
  }
  const code = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return code;
  }
  const flag = String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
  return `${flag} ${code}`;
}

function dateLabel(isoString: string | undefined): string {
  return isoString ? formatDate(isoString) : EMPTY;
}

function reasonLabel(reason: string | undefined): string {
  if (reason == null || reason === "") {
    return EMPTY;
  }
  const label = REASON_LABELS[reason];
  return label ? `${label} (${reason})` : reason;
}

function transactionLabel(transactionId: string | undefined): string {
  if (transactionId == null || transactionId === "") {
    return EMPTY;
  }
  if (transactionId.length <= TRANSACTION_ID_MAX_LENGTH) {
    return `\`${transactionId}\``;
  }
  return `\`${transactionId.slice(0, 8)}…${transactionId.slice(-6)}\``;
}

/**
 * 일일 가입 요약 관리자 알림 메시지 조립.
 */
export function buildDailySummaryMessage(summary: DailySignupSummary): AdminNotification {
  const previousDayTotal = sumBy(summary.signupsByProvider, (group) => group.count);

  const providerBreakdown = summary.signupsByProvider
    .map((group) => {
      const label = accountProviderLabel(group.provider);
      return `- ${label}: ${group.count}명`;
    })
    .join("\n");

  return createAdminNotification({
    title: `일일 가입 리포트 | ${summary.reportDateStr} (KST)`,
    body:
      previousDayTotal > 0
        ? `전일 신규 가입은 ${previousDayTotal}명입니다.\n\n가입 채널별\n${providerBreakdown}`
        : "전일 신규 가입은 0명입니다.",
    color: 0x5865f2,
    fields: [
      {
        name: "전일 신규 가입",
        value: `${previousDayTotal}명`,
        inline: true,
      },
      {
        name: "총 사용자 수",
        value: `${summary.totalUsers.toLocaleString()}명`,
        inline: true,
      },
      {
        name: "집계 기준",
        value: `${summary.reportDateStr} 00:00 ~ 23:59 (KST)`,
        inline: false,
      },
    ],
  });
}

function createAdminNotification(input: AdminNotification): AdminNotification {
  const content = AdminNotificationMessage.create(input);
  return {
    title: content.title,
    body: content.body,
    fields: (input.fields ?? []).map((field) => ({ ...field })),
    ...(input.color == null ? {} : { color: input.color }),
  };
}
