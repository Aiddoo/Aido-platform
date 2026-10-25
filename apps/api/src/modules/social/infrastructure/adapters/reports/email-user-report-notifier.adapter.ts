import { Injectable } from "@nestjs/common";

import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import type {
  UserReportDeliveryResult,
  UserReportNotifierPort,
} from "../../../application/ports/reports/user-report-notifier.port.js";
import type { UserReportSubmission } from "../../../application/read-models/reports/user-report-submission.read-model.js";

/** 신고 접수를 문의와 같은 고객센터 주소(SUPPORT_EMAIL)로 보낸다. 주소는 application에 노출하지 않는다. */
@Injectable()
export class EmailUserReportNotifierAdapter implements UserReportNotifierPort {
  constructor(
    private readonly emailSender: TransactionalEmailSender,
    private readonly configService: TypedConfigService,
  ) {}

  async notifyOperators(submission: UserReportSubmission): Promise<UserReportDeliveryResult> {
    const result = await this.emailSender.sendUserReport(
      this.configService.email.supportEmail,
      submission,
    );
    return { success: result.success, error: result.error };
  }
}
