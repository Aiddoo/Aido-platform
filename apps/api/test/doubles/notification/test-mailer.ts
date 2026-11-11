import { Mailer, MailModule, type MailTransport } from "@nestjs/mail";
import { Test } from "@nestjs/testing";

import { createEmailTemplateEngine } from "#api/modules/notification/email/infrastructure/adapters/nest-mail-module.config";

export interface TestMailer {
  readonly mailer: Mailer;
  close(): Promise<void>;
}

// 운영과 같은 템플릿 파일에 전송만 바꿔 끼운 Mailer. moduleRetry는 어댑터가 send마다 재시도를 끄는지 보려고 켠다
export async function createTestMailer(
  transport: MailTransport,
  moduleRetry: number | false = false,
): Promise<TestMailer> {
  const module = await Test.createTestingModule({
    imports: [
      MailModule.forRoot({
        transport,
        templates: createEmailTemplateEngine(),
        from: { name: "Aido", address: "noreply@example.com" },
        retry: moduleRetry,
      }),
    ],
  }).compile();
  return { mailer: module.get(Mailer), close: () => module.close() };
}
