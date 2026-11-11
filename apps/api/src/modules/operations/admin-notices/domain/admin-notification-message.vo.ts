import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

interface AdminNotificationCopy {
  readonly title: string;
  readonly body: string;
}

export class AdminNotificationMessage extends ValueObject<AdminNotificationCopy> {
  static create(input: AdminNotificationCopy): AdminNotificationMessage {
    if (input.title.trim().length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, {
        field: "title",
        reason: "관리자 알림 제목은 비어 있을 수 없습니다",
      });
    }
    if (input.body.trim().length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, {
        field: "body",
        reason: "관리자 알림 본문은 비어 있을 수 없습니다",
      });
    }
    return new AdminNotificationMessage({ title: input.title, body: input.body });
  }

  get title(): string {
    return this.value.title;
  }

  get body(): string {
    return this.value.body;
  }
}
