import type { InquiryCategory } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { InquiryContent } from "./inquiry-content.vo.js";

export interface InquiryPrimitives {
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
  readonly userId: UserId;
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly content: InquiryContent;
  readonly now: Temporal.Instant;
}

// 저장하지 않는다. 접수한 문의를 담당자에게 전달하는 동안만 존재한다
export class Inquiry extends AggregateRoot<null, InquiryProps> {
  static create(params: CreateInquiryParams): Inquiry {
    return new Inquiry(null, {
      userId: params.userId,
      userEmail: params.userEmail,
      category: params.category,
      content: params.content,
      submittedAt: params.now,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get category(): InquiryCategory {
    return this.props.category;
  }

  toPrimitives(): InquiryPrimitives {
    return {
      userId: this.props.userId.value,
      userEmail: this.props.userEmail,
      category: this.props.category,
      content: this.props.content.value,
      submittedAt: this.props.submittedAt,
    };
  }
}
