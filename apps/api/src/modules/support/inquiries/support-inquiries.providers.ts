import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { InquiryMailerPort } from "./application/ports/inquiry-mailer.port.js";
import { CreateInquiryUseCase } from "./application/use-cases/create-inquiry.use-case.js";
import { EmailInquiryMailerAdapter } from "./infrastructure/adapters/email-inquiry-mailer.adapter.js";

export const SUPPORT_INQUIRIES_PROVIDERS = [
  { provide: InquiryMailerPort, useClass: EmailInquiryMailerAdapter },
  provideUseCase(CreateInquiryUseCase, {
    clock: ClockPort,
    mailer: InquiryMailerPort,
    logger: loggerFor(CreateInquiryUseCase),
  }),
] satisfies Provider[];
