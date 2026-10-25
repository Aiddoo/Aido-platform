import { Injectable } from "@nestjs/common";

import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/index";

import type {
  UserReportDeliveryResult,
  UserReportNotifierPort,
} from "../../../application/ports/reports/user-report-notifier.port.js";
import type { UserReportSubmission } from "../../../application/read-models/reports/user-report-submission.read-model.js";
import {
  RESOLVE_USER_REPORT_OPERATION_ID,
  resolveUserReportPath,
} from "../../../presentation/controllers/reports/admin-user-report.constants.js";

const ADMIN_DOCS_PATH = "/api/admin/docs";

/**
 * 신고 접수를 문의와 같은 고객센터 주소(SUPPORT_EMAIL)로 보낸다. 주소는 application에 노출하지 않는다.
 * 운영자가 바로 처리할 수 있게 처리 API 경로와, 기준 주소가 있으면 관리자 문서의 처리 API 링크를 함께 넣는다.
 */
@Injectable()
export class EmailUserReportNotifierAdapter implements UserReportNotifierPort {
  constructor(
    private readonly emailSender: TransactionalEmailSender,
    private readonly configService: TypedConfigService,
  ) {}

  async notifyOperators(submission: UserReportSubmission): Promise<UserReportDeliveryResult> {
    const apiPublicUrl = this.configService.apiPublicUrl;
    const result = await this.emailSender.sendUserReport(this.configService.email.supportEmail, {
      ...submission,
      resolutionEndpoint: `POST ${resolveUserReportPath(submission.reportId)}`,
      resolutionDocsUrl:
        apiPublicUrl == null
          ? null
          : `${apiPublicUrl}${ADMIN_DOCS_PATH}#/${encodeURIComponent(SWAGGER_TAGS.ADMIN_REPORTS)}/${RESOLVE_USER_REPORT_OPERATION_ID}`,
    });
    return { success: result.success, error: result.error };
  }
}
