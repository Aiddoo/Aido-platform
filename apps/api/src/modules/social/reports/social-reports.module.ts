import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { NotificationEmailModule } from "#api/modules/notification/notification-email.public";

import { UserReportController } from "./presentation/http/v1/user-report.controller.js";
import { socialReportsConfig } from "./social-reports.config.js";
import { SOCIAL_REPORTS_PROVIDERS } from "./social-reports.providers.js";

// 신고를 저장하고 고객센터 이메일로 운영자에게 알린다
@Module({
  imports: [NotificationEmailModule, ConfigModule.forFeature(socialReportsConfig)],
  controllers: [UserReportController],
  providers: [...SOCIAL_REPORTS_PROVIDERS],
})
export class SocialReportsModule {}
