import { match } from "ts-pattern";

import type {
  AdminNotification,
  AdminNotificationField,
  AdminNotificationSeverity,
} from "../../../application/read-models/notifications/admin-notification.read-model.js";

export interface DiscordEmbed {
  readonly title: string;
  readonly description: string;
  readonly color: number;
  readonly fields: readonly { name: string; value: string; inline?: boolean }[];
  readonly url?: string;
  readonly timestamp: string;
}

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
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return iso;
  }
  return `<t:${Math.floor(time / 1000)}:f>`;
}

function renderField(field: AdminNotificationField): DiscordEmbed["fields"][number] {
  const value = match(field.value)
    .with({ kind: "text" }, ({ text }) => text)
    .with({ kind: "datetime" }, ({ iso }) => formatDiscordTimestamp(iso))
    .exhaustive();
  return field.inline == null
    ? { name: field.label, value }
    : { name: field.label, value, inline: field.inline };
}

export function renderDiscordEmbed(notification: AdminNotification, at: string): DiscordEmbed {
  return {
    title: notification.title,
    description: notification.body,
    color: severityColor(notification.severity),
    fields: (notification.fields ?? []).map(renderField),
    ...(notification.link == null ? {} : { url: notification.link }),
    timestamp: at,
  };
}
