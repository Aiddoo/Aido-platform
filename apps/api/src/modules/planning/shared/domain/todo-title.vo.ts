import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

// HTTP 경계의 Zod 규칙과 같다. 제목이 도메인에 들어오는 모든 경로가 이 VO를 거친다
const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 200;

export class TodoTitle extends ValueObject<string> {
  static create(title: string): TodoTitle {
    if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
      throw new DomainException(
        ErrorCode.SYS_0002,
        { titleLength: title.length, max: TITLE_MAX_LENGTH },
        `제목은 ${TITLE_MIN_LENGTH}~${TITLE_MAX_LENGTH}자여야 합니다.`,
      );
    }
    return new TodoTitle(title);
  }

  static reconstitute(title: string): TodoTitle {
    return new TodoTitle(title);
  }
}
