import type { StoreReviewGateway } from '@src/features/todo/services/store-review-prompt.service';
import * as StoreReview from 'expo-store-review';

export const expoStoreReviewGateway: StoreReviewGateway = {
  isAvailable: StoreReview.isAvailableAsync,
  requestReview: StoreReview.requestReview,
};
