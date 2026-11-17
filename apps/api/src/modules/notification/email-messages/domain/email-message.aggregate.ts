import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { EMAIL_KINDS, type EmailKind } from "./email-delivery.constants.js";
import type { EmailMessageId } from "./email-message-id.vo.js";
import {
  emailKindUnknown,
  emailRecipientMissing,
  emailSubjectMissing,
} from "./email-messages.errors.js";

export interface EmailTag {
  readonly name: string;
  readonly value: string;
}

interface EmailMessageProps {
  readonly kind: EmailKind;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly tags: readonly EmailTag[];
}

export interface CreateEmailMessageParams extends EmailMessageProps {
  readonly id: EmailMessageId;
}

export interface EmailMessagePrimitives extends EmailMessageProps {
  readonly id: string;
}

function copyTags(tags: readonly EmailTag[]): readonly EmailTag[] {
  return Object.freeze(tags.map((tag) => Object.freeze({ ...tag })));
}

/** 렌더된 메일 한 통. 저장하지 않고 큐에 담아 보낸다. 표시 템플릿과 공급자 전송은 다른 레이어가 맡는다. */
export class EmailMessage extends AggregateRoot<EmailMessageId, EmailMessageProps> {
  // 큐에서 꺼낸 메일도 담을 때와 같은 규칙으로 다시 만든다
  static create(params: CreateEmailMessageParams): EmailMessage {
    if (!EMAIL_KINDS.includes(params.kind)) {
      throw emailKindUnknown();
    }
    if (params.to.trim().length === 0) {
      throw emailRecipientMissing();
    }
    if (params.subject.trim().length === 0) {
      throw emailSubjectMissing();
    }
    return new EmailMessage(params.id, {
      kind: params.kind,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      tags: copyTags(params.tags),
    });
  }

  get kind(): EmailKind {
    return this.props.kind;
  }
  get to(): string {
    return this.props.to;
  }
  get subject(): string {
    return this.props.subject;
  }
  get html(): string {
    return this.props.html;
  }
  get text(): string {
    return this.props.text;
  }
  get tags(): readonly EmailTag[] {
    return this.props.tags.map((tag) => ({ ...tag }));
  }

  toPrimitives(): EmailMessagePrimitives {
    return {
      id: this.id.value,
      kind: this.props.kind,
      to: this.props.to,
      subject: this.props.subject,
      html: this.props.html,
      text: this.props.text,
      tags: this.tags,
    };
  }
}
