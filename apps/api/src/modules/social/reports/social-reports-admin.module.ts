import { Module } from "@nestjs/common";

import { AdminUserReportController } from "./presentation/http/v1/admin-user-report.controller.js";
import { SOCIAL_REPORTS_ADMIN_PROVIDERS } from "./social-reports.providers.js";

// 관리자 API 문서에만 싣도록 사용자용 신고 모듈과 나눈다
@Module({
  controllers: [AdminUserReportController],
  providers: [...SOCIAL_REPORTS_ADMIN_PROVIDERS],
})
export class SocialReportsAdminModule {}
