import { sumBy } from "es-toolkit";

import { AdminNotificationMessage } from "../../../domain/value-objects/notifications/admin-notification-message.vo.js";
import type {
  AdminNotification,
  AdminNotificationField,
  AdminNotificationFieldValue,
} from "../../read-models/notifications/admin-notification.read-model.js";
import type { SubscriptionAlertInput } from "../../types/notifications/subscription-alert.input.js";
import type { UserRegisteredEventPayload } from "../../types/notifications/user-registered.payload.js";
import { formatPrice } from "./admin-format.js";
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
  LIFECYCLE_EVENT_KEYS,
  PERIOD_TYPE_LABELS,
  PRODUCT_PERIOD_LABELS,
  REASON_LABELS,
  REFUND_CANCEL_REASON,
  REVENUECAT_EVENT_TO_INTERNAL,
  SANDBOX_SEVERITY,
  STORE_LABELS,
  type SubscriptionEventKey,
} from "./subscription-event-meta.js";

function text(value: string): AdminNotificationFieldValue {
  return { kind: "text", text: value };
}

function datetime(iso: string): AdminNotificationFieldValue {
  return { kind: "datetime", iso };
}

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
    severity: "success",
    fields: [
      { label: "이메일", value: text(payload.email), inline: true },
      { label: "이름", value: text(displayName), inline: true },
      {
        label: "가입 방식",
        value: text(PROVIDER_LABELS[payload.provider] ?? payload.provider),
        inline: true,
      },
      { label: "기기", value: text(signupDeviceLabel(payload)), inline: true },
      { label: "앱 버전", value: text(appVersionLabel(payload)), inline: true },
      { label: "언어·시간대", value: text(localeLabel(payload)), inline: true },
      { label: "사용자 ID", value: text(payload.userId), inline: false },
      { label: "가입 시각", value: datetime(payload.registeredAt), inline: false },
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
    { label: "이메일", value: text(payload.email), inline: true },
    { label: "이름", value: text(displayName), inline: true },
    { label: "상품", value: text(productLabel(payload.productId)), inline: true },
    { label: "스토어", value: text(lookup(STORE_LABELS, payload.store)), inline: true },
    { label: "기기", value: text(deviceLabel(payload)), inline: true },
    // 체험 시작은 ₩0 결제가 아니라 끝나는 날이 중요하다
    eventKey === "subscription.trial_started"
      ? { label: "체험 끝", value: dateValue(payload.expiresAt), inline: true }
      : { label: "금액", value: text(priceLabel(payload)), inline: true },
    { label: "환경", value: text(environmentLabel(payload.environment)), inline: true },
    {
      label: "구독 유형",
      value: text(lookup(PERIOD_TYPE_LABELS, payload.periodType)),
      inline: true,
    },
    {
      label: "자동 갱신",
      value: text((eventKey ? AUTO_RENEW_LABELS[eventKey] : undefined) ?? EMPTY),
      inline: true,
    },
    { label: "국가", value: text(countryLabel(payload.countryCode)), inline: true },
    { label: "구매일", value: dateValue(payload.purchasedAt), inline: true },
    { label: "만료일", value: dateValue(payload.expiresAt), inline: true },
  ];

  if (payload.eventType === "CANCELLATION") {
    fields.push({
      label: "취소 사유",
      value: text(reasonLabel(payload.cancelReason)),
      inline: false,
    });
  }
  if (payload.eventType === "EXPIRATION") {
    fields.push({
      label: "만료 사유",
      value: text(reasonLabel(payload.expirationReason)),
      inline: false,
    });
  }

  fields.push(
    { label: "트랜잭션", value: text(transactionLabel(payload.transactionId)), inline: false },
    { label: "사용자 ID", value: text(payload.userId), inline: false },
  );

  return createAdminNotification({
    title: `${isSandbox ? "[샌드박스] " : ""}${meta.emoji} ${meta.title}`,
    body: `**${displayName}** 님의 구독 이벤트 (${payload.eventType})`,
    severity: isSandbox ? SANDBOX_SEVERITY : meta.severity,
    fields,
    link: payload.revenueCatCustomerUrl,
  });
}

function resolveEventKey(payload: SubscriptionAlertInput): SubscriptionEventKey | undefined {
  if (payload.eventType === "CANCELLATION" && payload.cancelReason === REFUND_CANCEL_REASON) {
    return "subscription.refunded";
  }
  if (payload.lifecycle != null) {
    return LIFECYCLE_EVENT_KEYS[payload.lifecycle];
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

function dateValue(isoString: string | undefined): AdminNotificationFieldValue {
  return isoString ? datetime(isoString) : text(EMPTY);
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
    severity: "info",
    fields: [
      {
        label: "전일 신규 가입",
        value: text(`${previousDayTotal}명`),
        inline: true,
      },
      {
        label: "총 사용자 수",
        value: text(`${summary.totalUsers.toLocaleString()}명`),
        inline: true,
      },
      {
        label: "집계 기준",
        value: text(`${summary.reportDateStr} 00:00 ~ 23:59 (KST)`),
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
    severity: input.severity,
    ...(input.link ? { link: input.link } : {}),
  };
}
