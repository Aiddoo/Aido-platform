import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

export interface BroadcastCopy {
  readonly title: string;
  readonly body: string;
}

export class BroadcastContent extends ValueObject<BroadcastCopy> {
  static create(input: BroadcastCopy): BroadcastContent {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length === 0 || body.length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, {
        reason: "브로드캐스트 제목/본문은 비어 있을 수 없습니다",
      });
    }
    return new BroadcastContent({ title, body });
  }

  static reconstitute(input: BroadcastCopy): BroadcastContent {
    return new BroadcastContent({ title: input.title, body: input.body });
  }

  get title(): string {
    return this.value.title;
  }

  get body(): string {
    return this.value.body;
  }
}
