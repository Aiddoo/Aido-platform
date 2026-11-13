import type { AppStoreListingGateway } from '@src/core/ports/app-store-listing-gateway';
import type { AppStoreReviewGateway } from '@src/core/ports/app-store-review-gateway';

import { mockMethod } from '../mock-method';

/** 스토어 평점 창을 띄울 수 있는 기기가 기본값이다 */
export function createAppStoreReviewGatewayStub(): jest.Mocked<AppStoreReviewGateway> {
  return {
    isAvailable: mockMethod<AppStoreReviewGateway['isAvailable']>(async () => true),
    requestReview: mockMethod<AppStoreReviewGateway['requestReview']>(async () => {}),
  };
}

export function createAppStoreListingGatewayStub(): jest.Mocked<AppStoreListingGateway> {
  return {
    openListing: mockMethod<AppStoreListingGateway['openListing']>(async () => {}),
  };
}
