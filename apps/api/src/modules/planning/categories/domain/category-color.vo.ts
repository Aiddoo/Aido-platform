import { ErrorCode } from "@aido/api/errors";
import { hexColorRegex } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

// 계약(zod)과 같은 정규식이라 유효한 요청은 통과한다. 도메인 경계에서도 한 번 더 막는다
export class CategoryColor extends ValueObject<string> {
  static create(raw: string): CategoryColor {
    if (!hexColorRegex.test(raw)) {
      throw new DomainException(ErrorCode.SYS_0002, {
        message: "HEX 색상 코드 형식이 아닙니다",
      });
    }
    return new CategoryColor(raw);
  }

  static reconstitute(raw: string): CategoryColor {
    return new CategoryColor(raw);
  }
}
