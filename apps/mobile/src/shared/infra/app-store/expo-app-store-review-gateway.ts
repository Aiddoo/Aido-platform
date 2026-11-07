import type { AppStoreReviewGateway } from '@src/core/ports/app-store-review-gateway';
import * as StoreReview from 'expo-store-review';

export const expoAppStoreReviewGateway: AppStoreReviewGateway = {
  isAvailable: StoreReview.isAvailableAsync,
  requestReview: StoreReview.requestReview,
};
