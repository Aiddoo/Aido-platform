import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { AiReportId } from "../domain/ai-report-id.vo.js";

export function aiReportNotFound(reportId: AiReportId): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1304, { reportId: reportId.value });
}

/** 같은 사용자·종류·주기의 리포트가 이미 저장됐다. 생성 작업은 건너뛰고 HTTP로 나가지 않는다. */
export class DuplicateAiReportError extends Error {
  constructor() {
    super("AiReport_userId_type_year_period_key");
    this.name = DuplicateAiReportError.name;
  }
}
