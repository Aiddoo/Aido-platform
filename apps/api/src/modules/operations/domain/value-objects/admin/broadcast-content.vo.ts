import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export class BroadcastContent {
  readonly #title: string;
  readonly #body: string;

  private constructor(title: string, body: string) {
    this.#title = title;
    this.#body = body;
  }

  static create(input: { readonly title: string; readonly body: string }): BroadcastContent {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length === 0 || body.length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, {
        reason: "브로드캐스트 제목/본문은 비어 있을 수 없습니다",
      });
    }
    return new BroadcastContent(title, body);
  }

  get title(): string {
    return this.#title;
  }

  get body(): string {
    return this.#body;
  }
}
