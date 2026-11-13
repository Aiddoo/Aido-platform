import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { resolutionNoteLengthOutOfRange } from "./reports.errors.js";

// 운영자가 무엇을 했는지 남기지 않은 처리는 받지 않는다
export class UserReportResolutionNote extends ValueObject<string> {
  static create(raw: string): UserReportResolutionNote {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > USER_REPORT_LIMITS.MAX_RESOLUTION_NOTE_LENGTH) {
      throw resolutionNoteLengthOutOfRange();
    }
    return new UserReportResolutionNote(trimmed);
  }

  static reconstitute(raw: string): UserReportResolutionNote {
    return new UserReportResolutionNote(raw);
  }
}
