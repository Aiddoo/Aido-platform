import type { AppStoreListingGateway, AppStoreReviewGateway } from '@src/core/ports/app-store';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';

export const expoAppStoreGateway: AppStoreReviewGateway & AppStoreListingGateway = {
  isAvailable: StoreReview.isAvailableAsync,
  requestReview: StoreReview.requestReview,
  async openListing() {
    const url = StoreReview.storeUrl();
    if (!url) throw new Error('App store listing URL is unavailable');
    await Linking.openURL(url);
  },
};
