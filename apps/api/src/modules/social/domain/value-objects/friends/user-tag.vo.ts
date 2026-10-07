import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

const USER_TAG_PATTERN = /^[A-Z0-9]{8}$/;

export class UserTag {
  private constructor(private readonly tag: string) {}

  static of(value: string): UserTag {
    if (!USER_TAG_PATTERN.test(value)) {
      throw new DomainException(ErrorCode.SYS_0002, { userTag: value });
    }
    return new UserTag(value);
  }

  get value(): string {
    return this.tag;
  }

  equals(other: UserTag): boolean {
    return this.tag === other.tag;
  }
}
