import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationEmailModule } from "#api/modules/notification/notification-email.public";

import { UserReportController } from "./presentation/http/v1/user-report.controller.js";
import { socialUserReportsConfig } from "./social-user-reports.config.js";
import { SOCIAL_USER_REPORTS_PROVIDERS } from "./social-user-reports.providers.js";

// 신고를 저장하고 고객센터 이메일로 운영자에게 알린다
@Module({
  imports: [
    IdentityUserAccessModule,
    NotificationEmailModule,
    ConfigModule.forFeature(socialUserReportsConfig),
  ],
  controllers: [UserReportController],
  providers: [...SOCIAL_USER_REPORTS_PROVIDERS],
})
export class SocialUserReportsModule {}
