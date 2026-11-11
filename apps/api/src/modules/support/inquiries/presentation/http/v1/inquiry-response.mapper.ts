import type { CreateInquiryResponse } from "@aido/api/contracts/inquiry";

// 출시 앱 계약 필드라 문구를 그대로 둔다
const INQUIRY_RESPONSE_MESSAGES = {
  SUBMITTED: "문의가 접수되었습니다.",
} as const;

export function toCreateInquiryResponse(): CreateInquiryResponse {
  return { message: INQUIRY_RESPONSE_MESSAGES.SUBMITTED };
}
