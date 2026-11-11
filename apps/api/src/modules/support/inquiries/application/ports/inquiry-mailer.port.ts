import type { InquirySubmission } from "../read-models/inquiry-submission.read-model.js";

export type InquiryDeliveryResult =
  | { readonly status: "sent" }
  | { readonly status: "rejected"; readonly reason: string };

// 전달 채널(이메일, 이후 슬랙·웹훅)은 어댑터가 정한다. 요청 안에서 한 번 보내고 거절은 값으로 돌려준다
export abstract class InquiryMailerPort {
  abstract deliver(submission: InquirySubmission): Promise<InquiryDeliveryResult>;
}
