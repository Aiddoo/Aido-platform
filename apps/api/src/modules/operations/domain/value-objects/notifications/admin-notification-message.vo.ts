import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export class AdminNotificationMessage {
  readonly #title: string;
  readonly #body: string;

  private constructor(title: string, body: string) {
    this.#title = title;
    this.#body = body;
  }

  static create(input: {
    readonly title: string;
    readonly body: string;
  }): AdminNotificationMessage {
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
    return new AdminNotificationMessage(input.title, input.body);
  }

  get title(): string {
    return this.#title;
  }

  get body(): string {
    return this.#body;
  }
}
