import { ErrorCode } from "@aido/api/errors";
import { INQUIRY_CONTENT_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

// 담당자가 사용자 원문을 그대로 읽으므로 공백도 다듬지 않는다
export class InquiryContent extends ValueObject<string> {
  static create(raw: string): InquiryContent {
    const isWithinLimit =
      INQUIRY_CONTENT_LIMITS.MIN_LENGTH <= raw.length &&
      raw.length <= INQUIRY_CONTENT_LIMITS.MAX_LENGTH;
    if (!isWithinLimit) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "content", length: raw.length });
    }
    return new InquiryContent(raw);
  }
}
