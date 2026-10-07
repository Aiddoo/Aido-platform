import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export interface EmailTag {
  readonly name: string;
  readonly value: string;
}
export type EmailType =
  | "verification"
  | "password-reset"
  | "password-setup"
  | "notification"
  | "inquiry";
export interface EmailMessageProps {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly tags: readonly EmailTag[];
  readonly idempotencyKey?: string;
}

/** 검증된 발송 메시지 값. 표시 템플릿과 공급자 전송은 별도 레이어가 소유한다. */
export class EmailMessage {
  readonly #props: EmailMessageProps;
  private constructor(props: EmailMessageProps) {
    this.#props = { ...props, tags: props.tags.map((tag) => ({ ...tag })) };
  }
  static create(props: EmailMessageProps): EmailMessage {
    if (props.to.trim().length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "to" });
    }
    if (props.subject.trim().length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "subject" });
    }
    return new EmailMessage(props);
  }
  get to(): string {
    return this.#props.to;
  }
  get subject(): string {
    return this.#props.subject;
  }
  get html(): string {
    return this.#props.html;
  }
  get text(): string {
    return this.#props.text;
  }
  get tags(): readonly EmailTag[] {
    return this.#props.tags.map((tag) => ({ ...tag }));
  }
  get idempotencyKey(): string | undefined {
    return this.#props.idempotencyKey;
  }
  withTag(tag: EmailTag): EmailMessage {
    return new EmailMessage({ ...this.#props, tags: [...this.#props.tags, tag] });
  }
}
