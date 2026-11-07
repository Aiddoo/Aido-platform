export interface AppStoreReviewGateway {
  isAvailable(): Promise<boolean>;
  requestReview(): Promise<void>;
}
