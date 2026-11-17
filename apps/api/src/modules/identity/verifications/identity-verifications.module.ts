import { Module } from "@nestjs/common";

import { NotificationEmailMessagesModule } from "#api/modules/notification/email-messages/notification-email-messages.public";

import { IdentityUsersQueriesModule } from "../users/identity-users-queries.module.js";
import { VerificationRepositoryPort } from "./application/ports/verification.repository.port.js";
import { CheckVerificationEmailCapUseCase } from "./application/use-cases/check-verification-email-cap.use-case.js";
import { ConsumeVerificationCodeUseCase } from "./application/use-cases/consume-verification-code.use-case.js";
import { IssueVerificationCodeUseCase } from "./application/use-cases/issue-verification-code.use-case.js";
import { RecordVerificationEmailSentUseCase } from "./application/use-cases/record-verification-email-sent.use-case.js";
import { SendVerificationCodeUseCase } from "./application/use-cases/send-verification-code.use-case.js";
import { IDENTITY_VERIFICATIONS_PROVIDERS } from "./identity-verifications.providers.js";
import { VerificationController } from "./presentation/http/v1/verification.controller.js";

// 가입(users)·비밀번호 재설정(linked-accounts)·이메일 인증(sessions)이 코드 상한·발급·소비 UseCase를 쓰고
// 보관 기한 정리(users)가 저장소를 쓴다
@Module({
  imports: [IdentityUsersQueriesModule, NotificationEmailMessagesModule],
  controllers: [VerificationController],
  providers: [...IDENTITY_VERIFICATIONS_PROVIDERS],
  exports: [
    CheckVerificationEmailCapUseCase,
    RecordVerificationEmailSentUseCase,
    IssueVerificationCodeUseCase,
    SendVerificationCodeUseCase,
    ConsumeVerificationCodeUseCase,
    VerificationRepositoryPort,
  ],
})
export class IdentityVerificationsModule {}
