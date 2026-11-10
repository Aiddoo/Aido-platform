import { ErrorCode } from "@aido/api/errors";
import { omit } from "es-toolkit";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

import type { EmailKind } from "./email-delivery.constants.js";

export interface EmailTag {
  readonly name: string;
  readonly value: string;
}
export interface EmailMessageProps {
  readonly kind: EmailKind;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly tags: readonly EmailTag[];
  /** 공급자 멱등 키. 큐에서 꺼낸 메시지는 발송 건의 deliveryId다 */
  readonly idempotencyKey?: string;
}

function copyProps(props: EmailMessageProps): EmailMessageProps {
  return { ...props, tags: Object.freeze(props.tags.map((tag) => Object.freeze({ ...tag }))) };
}

/** 렌더된 발송 메시지. 표시 템플릿과 공급자 전송은 다른 레이어가 맡는다. */
export class EmailMessage extends ValueObject<EmailMessageProps> {
  static create(props: EmailMessageProps): EmailMessage {
    if (props.to.trim().length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "to" });
    }
    if (props.subject.trim().length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "subject" });
    }
    return new EmailMessage(copyProps(props));
  }

  // 큐에 담겼던 메시지는 담을 때 이미 검증했다
  static reconstitute(props: EmailMessageProps): EmailMessage {
    return new EmailMessage(copyProps(props));
  }

  get kind(): EmailKind {
    return this.value.kind;
  }
  get to(): string {
    return this.value.to;
  }
  get subject(): string {
    return this.value.subject;
  }
  get html(): string {
    return this.value.html;
  }
  get text(): string {
    return this.value.text;
  }
  get tags(): readonly EmailTag[] {
    return this.value.tags.map((tag) => ({ ...tag }));
  }
  get idempotencyKey(): string | undefined {
    return this.value.idempotencyKey;
  }

  /** 큐에 담을 값. 멱등 키는 발송 건(deliveryId)이 정하므로 담지 않는다. */
  toPrimitives(): Omit<EmailMessageProps, "idempotencyKey"> {
    return { ...omit(this.value, ["idempotencyKey"]), tags: this.tags };
  }
}
