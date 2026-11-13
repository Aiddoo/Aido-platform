import { TODO_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { todoTitleLengthOutOfRange } from "./planning.errors.js";

// HTTP 경계의 Zod 규칙과 같다. 제목이 도메인에 들어오는 모든 경로가 이 VO를 거친다
const TITLE_MIN_LENGTH = 1;

export class TodoTitle extends ValueObject<string> {
  static create(title: string): TodoTitle {
    if (title.length < TITLE_MIN_LENGTH || title.length > TODO_LIMITS.TITLE_MAX_LENGTH) {
      throw todoTitleLengthOutOfRange(title.length, TITLE_MIN_LENGTH);
    }
    return new TodoTitle(title);
  }

  static reconstitute(title: string): TodoTitle {
    return new TodoTitle(title);
  }
}
