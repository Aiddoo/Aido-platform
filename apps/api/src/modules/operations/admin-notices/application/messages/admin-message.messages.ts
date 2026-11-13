import { sumBy } from "es-toolkit";

import { AdminNotificationMessage } from "../../domain/admin-notification-message.vo.js";
import type {
  AdminNotification,
  AdminNotificationFieldValue,
} from "../read-models/admin-notification.read-model.js";
import { accountProviderLabel } from "./provider-labels.messages.js";

function text(value: string): AdminNotificationFieldValue {
  return { kind: "text", text: value };
}

export interface DailySignupSummary {
  readonly signupsByProvider: readonly { readonly provider: string; readonly count: number }[];
  readonly totalUsers: number;
  readonly reportDateStr: string;
}

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
