import type { InquiryCategory } from '@aido/api';

interface InquiryHrefParams {
  category?: InquiryCategory;
  /** 미리 채워 둘 문의 내용. 오류 코드처럼 사용자가 그대로 보내도 되는 내용만 담는다 */
  content?: string;
}

/** 문의 화면은 한 화면이고 고를 분류와 미리 채울 내용은 query param으로 넘긴다. */
export function createInquiryHref({ category, content }: InquiryHrefParams = {}) {
  return {
    pathname: '/settings/inquiry',
    params: { ...(category != null && { category }), ...(content != null && { content }) },
  } as const;
}
