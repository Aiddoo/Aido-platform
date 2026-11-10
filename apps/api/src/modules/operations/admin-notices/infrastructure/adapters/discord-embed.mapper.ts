import { match } from "ts-pattern";

import type { AdminNotice } from "../../application/read-models/admin-notice.read-model.js";
import type {
  AdminNotification,
  AdminNotificationField,
  AdminNotificationSeverity,
} from "../../application/read-models/admin-notification.read-model.js";
import {
  type DiscordEmbed,
  type DiscordEmbedField,
  field,
} from "./discord-notice-format.mapper.js";
import { renderSignupNoticeEmbed } from "./discord-signup-notice.mapper.js";
import { renderSubscriptionNoticeEmbed } from "./discord-subscription-notice.mapper.js";

export type { DiscordEmbed };

function severityColor(severity: AdminNotificationSeverity): number {
  return match(severity)
    .with("info", () => 0x5865f2)
    .with("success", () => 0x57f287)
    .with("warning", () => 0xf1c40f)
    .with("critical", () => 0xe74c3c)
    .exhaustive();
}

/** ISO 시각을 Discord 타임스탬프(`<t:unix:f>`)로 바꾼다. 읽을 수 없는 값은 원문 그대로 둔다. */
function formatDiscordTimestamp(iso: string): string {
  try {
    return `<t:${Math.floor(Temporal.Instant.from(iso).epochMilliseconds / 1000)}:f>`;
  } catch {
    return iso;
  }
}

function renderMessageField(notificationField: AdminNotificationField): DiscordEmbedField {
  const value = match(notificationField.value)
    .with({ kind: "text" }, ({ text }) => text)
    .with({ kind: "datetime" }, ({ iso }) => formatDiscordTimestamp(iso))
    .exhaustive();
  const rendered = field(notificationField.label, value, notificationField.inline ?? false);
  return notificationField.inline == null
    ? { name: rendered.name, value: rendered.value }
    : rendered;
}

function renderMessageEmbed(notification: AdminNotification, at: string): DiscordEmbed {
  return {
    title: notification.title,
    description: notification.body,
    color: severityColor(notification.severity),
    fields: (notification.fields ?? []).map(renderMessageField),
    ...(notification.link == null ? {} : { url: notification.link }),
    timestamp: at,
  };
}

/**
 * 관리자 알림을 Discord embed 하나로 그린다. 제목·이모지·색·필드 배치·날짜 표시는 모두 이 어댑터가 정한다.
 */
export function renderDiscordEmbed(notice: AdminNotice, at: string): DiscordEmbed {
  return match(notice)
    .with({ type: "message" }, ({ message }) => renderMessageEmbed(message, at))
    .with({ type: "user_registered" }, ({ user, signup }) =>
      renderSignupNoticeEmbed(user, signup, at),
    )
    .with({ type: "subscription_event" }, ({ user, subscription }) =>
      renderSubscriptionNoticeEmbed(user, subscription, at),
    )
    .exhaustive();
}
