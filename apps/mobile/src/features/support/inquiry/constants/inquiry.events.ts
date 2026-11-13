import type { InquiryCategory } from '@aido/api/vocabulary';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 서버가 문의를 접수했을 때. 내용은 싣지 않는다 */
    support_inquiry_submitted: { category: InquiryCategory };
  }
}
