import { ErrorCode } from "@aido/api/errors";
import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

// 운영자가 무엇을 했는지 남기지 않은 처리는 받지 않는다
export class UserReportResolutionNote extends ValueObject<string> {
  static create(raw: string): UserReportResolutionNote {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > USER_REPORT_LIMITS.MAX_RESOLUTION_NOTE_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        maxLength: USER_REPORT_LIMITS.MAX_RESOLUTION_NOTE_LENGTH,
      });
    }
    return new UserReportResolutionNote(trimmed);
  }

  static reconstitute(raw: string): UserReportResolutionNote {
    return new UserReportResolutionNote(raw);
  }
}
