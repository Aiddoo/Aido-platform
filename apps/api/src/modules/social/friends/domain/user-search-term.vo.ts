import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidUserSearchTerm } from "./friends.errors.js";

export class UserSearchTerm extends ValueObject<string> {
  // 조합형 한글과 연속 공백을 맞춰 같은 이름이 같은 검색어가 되게 한다
  static create(raw: string): UserSearchTerm {
    const normalized = raw.normalize("NFC").trim().replace(/\s+/g, " ");
    if (normalized.length === 0) {
      throw invalidUserSearchTerm(raw);
    }
    return new UserSearchTerm(normalized);
  }

  static reconstitute(raw: string): UserSearchTerm {
    return new UserSearchTerm(raw);
  }

  // 태그는 대문자로만 저장돼 정확·앞부분 일치는 대문자 검색어로 비교한다
  get upperTag(): string {
    return this.value.toUpperCase();
  }
}
