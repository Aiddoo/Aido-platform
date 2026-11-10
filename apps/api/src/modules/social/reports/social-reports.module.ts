import { Module } from "@nestjs/common";

import { NotificationEmailModule } from "#api/modules/notification/notification-email.public";

import { USER_REPORT_NOTIFIER } from "./application/ports/user-report-notifier.port.js";
import { USER_REPORT_REPOSITORY } from "./application/ports/user-report.repository.port.js";
import { EmailUserReportNotifierAdapter } from "./infrastructure/adapters/email-user-report-notifier.adapter.js";
import { DrizzleUserReportRepository } from "./infrastructure/persistence/drizzle-user-report.repository.js";
import { UserReportController } from "./presentation/http/v1/user-report.controller.js";
import { reportContentProvider } from "./social-reports.providers.js";

/** 사용자·콘텐츠 신고 slice. 신고를 저장하고 고객센터 이메일로 운영자에게 알린다. */
@Module({
  imports: [NotificationEmailModule],
  controllers: [UserReportController],
  providers: [
    { provide: USER_REPORT_REPOSITORY, useClass: DrizzleUserReportRepository },
    { provide: USER_REPORT_NOTIFIER, useClass: EmailUserReportNotifierAdapter },
    reportContentProvider,
  ],
})
export class SocialReportsModule {}
