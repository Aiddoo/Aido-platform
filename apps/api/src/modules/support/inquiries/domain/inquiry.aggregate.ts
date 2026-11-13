import type { InquiryCategory } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { InquiryContent } from "./inquiry-content.vo.js";
import { InquiryId } from "./inquiry-id.vo.js";

export interface InquiryPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly content: string;
  readonly submittedAt: Temporal.Instant;
}

interface InquiryProps {
  readonly userId: UserId;
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly content: InquiryContent;
  readonly submittedAt: Temporal.Instant;
}

interface CreateInquiryParams {
  readonly id: InquiryId;
  readonly userId: UserId;
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly content: InquiryContent;
  readonly now: Temporal.Instant;
}

// 저장하지 않는다. 접수한 문의를 담당자에게 전달하는 동안만 존재한다
export class Inquiry extends AggregateRoot<InquiryId, InquiryProps> {
  static create(params: CreateInquiryParams): Inquiry {
    return new Inquiry(params.id, {
      userId: params.userId,
      userEmail: params.userEmail,
      category: params.category,
      content: params.content,
      submittedAt: params.now,
    });
  }

  static reconstitute(primitives: InquiryPrimitives): Inquiry {
    return new Inquiry(InquiryId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      userEmail: primitives.userEmail,
      category: primitives.category,
      content: InquiryContent.reconstitute(primitives.content),
      submittedAt: primitives.submittedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get userEmail(): string {
    return this.props.userEmail;
  }

  get category(): InquiryCategory {
    return this.props.category;
  }

  get content(): InquiryContent {
    return this.props.content;
  }

  get submittedAt(): Temporal.Instant {
    return this.props.submittedAt;
  }

  toPrimitives(): InquiryPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      userEmail: this.props.userEmail,
      category: this.props.category,
      content: this.props.content.value,
      submittedAt: this.props.submittedAt,
    };
  }
}
