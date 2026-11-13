import type { StoreReviewMoment } from '../domains/store-review.model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** OS 리뷰 창을 요청한 순간. 창을 실제로 띄웠는지는 OS가 알려 주지 않는다 */
    store_review_requested: { moment: StoreReviewMoment };
  }
}
