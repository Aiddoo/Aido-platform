import { resolve } from "node:path";

import {
  FileTemplateEngine,
  LogMailTransport,
  type MailModuleOptions,
  type MailTransport,
  ResendTransport,
} from "@nestjs/mail";

import type { EmailProviderId } from "#api/platform/config/schemas/email.schema";

import type { NotificationEmailConfig } from "../../notification-email.config.js";
import { EMAIL_SEND_TIMEOUT_MS } from "./email-outbound.policy.js";

// 빌드는 nest-cli assets로 템플릿을 dist의 같은 상대 경로에 복사해 소스·dist에서 같은 경로가 된다
const EMAIL_TEMPLATES_PATH = resolve(import.meta.dirname, "../templates");

export function createEmailTemplateEngine(): FileTemplateEngine {
  return new FileTemplateEngine({ dir: EMAIL_TEMPLATES_PATH, layout: "layout" });
}

// log와 키 없는 resend는 LogEmailSenderAdapter·not_configured가 먼저 끝내 Mailer는 렌더만 한다.
// 그래도 전송이 불리면 본문 없이 로그만 남는 패키지 전송을 둔다
const transports = {
  resend: (apiKey) =>
    apiKey == null
      ? new LogMailTransport({ body: false })
      : new ResendTransport({ apiKey, timeout: EMAIL_SEND_TIMEOUT_MS }),
  log: () => new LogMailTransport({ body: false }),
} satisfies Record<EmailProviderId, (apiKey: string | null) => MailTransport>;

export function createMailModuleOptions(config: NotificationEmailConfig): MailModuleOptions {
  return {
    transport: transports[config.provider](config.apiKey),
    from: { name: config.fromName, address: config.from },
    // 재시도는 pg-boss email-delivery.v1 한 층에만 둔다
    retry: false,
  };
}
