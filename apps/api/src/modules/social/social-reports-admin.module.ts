import { Module } from "@nestjs/common";

import { USER_REPORT_REPOSITORY } from "./application/ports/reports/user-report.repository.port.js";
import { PrismaUserReportRepository } from "./infrastructure/persistence/reports/prisma-user-report.repository.js";
import { AdminUserReportController } from "./presentation/controllers/reports/admin-user-report.controller.js";
import { resolveUserReportProvider } from "./social-reports-application.providers.js";

/** 운영자의 신고 처리. 관리자 API 문서에만 싣도록 사용자용 신고 slice와 모듈을 나눈다. */
@Module({
  controllers: [AdminUserReportController],
  providers: [
    { provide: USER_REPORT_REPOSITORY, useClass: PrismaUserReportRepository },
    resolveUserReportProvider,
  ],
})
export class SocialReportsAdminModule {}
