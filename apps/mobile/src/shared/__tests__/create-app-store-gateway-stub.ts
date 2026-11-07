import type {
  AppStoreListingGateway,
  AppStoreReviewGateway,
} from '@src/core/ports/app-store-gateway';

/** 스토어 평점 창을 띄울 수 있는 기기가 기본값이다 */
export const createAppStoreReviewGatewayStub = (): jest.Mocked<AppStoreReviewGateway> => ({
  isAvailable: jest.fn().mockResolvedValue(true),
  requestReview: jest.fn().mockResolvedValue(undefined),
});

export const createAppStoreListingGatewayStub = (): jest.Mocked<AppStoreListingGateway> => ({
  openListing: jest.fn().mockResolvedValue(undefined),
});
