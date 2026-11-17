import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { UserRepositoryPort } from "../users/application/ports/user.repository.port.js";
import { VerificationCodeEmailSenderPort } from "./application/ports/verification-code-email-sender.port.js";
import { VerificationCodeSecurityPort } from "./application/ports/verification-code-security.port.js";
import { VerificationEmailCapPort } from "./application/ports/verification-email-cap.port.js";
import { VerificationRepositoryPort } from "./application/ports/verification.repository.port.js";
import { ConsumeVerificationCodeUseCase } from "./application/use-cases/consume-verification-code.use-case.js";
import { IssueVerificationCodeUseCase } from "./application/use-cases/issue-verification-code.use-case.js";
import { ResendVerificationUseCase } from "./application/use-cases/resend-verification.use-case.js";
import { ReserveVerificationEmailSlotUseCase } from "./application/use-cases/reserve-verification-email-slot.use-case.js";
import { SendVerificationCodeUseCase } from "./application/use-cases/send-verification-code.use-case.js";
import { NodeVerificationCodeSecurityAdapter } from "./infrastructure/adapters/node-verification-code-security.adapter.js";
import { VerificationCodeEmailSenderAdapter } from "./infrastructure/adapters/verification-code-email-sender.adapter.js";
import { VerificationEmailCapAdapter } from "./infrastructure/adapters/verification-email-cap.adapter.js";
import { DrizzleVerificationRepository } from "./infrastructure/persistence/drizzle-verification.repository.js";

export const issueVerificationCodeProvider = provideUseCase(IssueVerificationCodeUseCase, {
  verificationRepository: VerificationRepositoryPort,
  verificationCodeSecurity: VerificationCodeSecurityPort,
  clock: ClockPort,
  logger: loggerFor(IssueVerificationCodeUseCase),
});

export const reserveVerificationEmailSlotProvider = provideUseCase(
  ReserveVerificationEmailSlotUseCase,
  { verificationEmailCap: VerificationEmailCapPort, clock: ClockPort },
);

export const sendVerificationCodeProvider = provideUseCase(SendVerificationCodeUseCase, {
  emailSender: VerificationCodeEmailSenderPort,
  logger: loggerFor(SendVerificationCodeUseCase),
});

export const consumeVerificationCodeProvider = provideUseCase(ConsumeVerificationCodeUseCase, {
  verificationRepository: VerificationRepositoryPort,
  verificationCodeSecurity: VerificationCodeSecurityPort,
  clock: ClockPort,
  logger: loggerFor(ConsumeVerificationCodeUseCase),
});

const resendVerificationProvider = provideUseCase(ResendVerificationUseCase, {
  userRepository: UserRepositoryPort,
  reserveVerificationEmailSlot: ReserveVerificationEmailSlotUseCase,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(ResendVerificationUseCase),
});

export const IDENTITY_VERIFICATIONS_PROVIDERS = [
  { provide: VerificationRepositoryPort, useClass: DrizzleVerificationRepository },
  { provide: VerificationCodeSecurityPort, useClass: NodeVerificationCodeSecurityAdapter },
  { provide: VerificationCodeEmailSenderPort, useClass: VerificationCodeEmailSenderAdapter },
  { provide: VerificationEmailCapPort, useClass: VerificationEmailCapAdapter },
  reserveVerificationEmailSlotProvider,
  issueVerificationCodeProvider,
  sendVerificationCodeProvider,
  consumeVerificationCodeProvider,
  resendVerificationProvider,
] satisfies Provider[];
