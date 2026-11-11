import { Inject, Injectable } from "@nestjs/common";

import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";

import type {
  UserReportDeliveryResult,
  UserReportNotifierPort,
} from "../../application/ports/user-report-notifier.port.js";
import type { UserReportSubmission } from "../../application/read-models/user-report-submission.read-model.js";
import {
  RESOLVE_USER_REPORT_OPERATION_ID,
  resolveUserReportPath,
} from "../../presentation/http/v1/admin-user-report.constants.js";
import { type SocialReportsConfig, socialReportsConfig } from "../../social-reports.config.js";

const ADMIN_DOCS_PATH = "/api/admin/docs";

/**
 * 신고 접수를 문의와 같은 고객센터 주소(SUPPORT_EMAIL)로 보낸다. 주소는 application에 노출하지 않는다.
 * 운영자가 바로 처리할 수 있게 처리 API 경로와, 기준 주소가 있으면 관리자 문서의 처리 API 링크를 함께 넣는다.
 */
@Injectable()
export class EmailUserReportNotifierAdapter implements UserReportNotifierPort {
  readonly #emailSender: TransactionalEmailSender;
  readonly #config: SocialReportsConfig;

  constructor(
    emailSender: TransactionalEmailSender,
    @Inject(socialReportsConfig.KEY) config: SocialReportsConfig,
  ) {
    this.#emailSender = emailSender;
    this.#config = config;
  }

  notifyOperators(submission: UserReportSubmission): Promise<UserReportDeliveryResult> {
    const { apiPublicUrl, supportEmail } = this.#config;
    return this.#emailSender.sendUserReport(supportEmail, {
      ...submission,
      resolutionEndpoint: `POST ${resolveUserReportPath(submission.reportId)}`,
      resolutionDocsUrl:
        apiPublicUrl == null
          ? null
          : `${apiPublicUrl}${ADMIN_DOCS_PATH}#/${encodeURIComponent(SWAGGER_TAGS.ADMIN_REPORTS)}/${RESOLVE_USER_REPORT_OPERATION_ID}`,
    });
  }
}
