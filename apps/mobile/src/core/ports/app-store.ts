export interface AppStoreReviewGateway {
  isAvailable(): Promise<boolean>;
  requestReview(): Promise<void>;
}

export interface AppStoreListingGateway {
  openListing(): Promise<void>;
}
