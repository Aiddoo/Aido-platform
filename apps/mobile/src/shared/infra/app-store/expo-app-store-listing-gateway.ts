import type { AppStoreListingGateway } from '@src/core/ports/app-store-listing-gateway';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';

export const expoAppStoreListingGateway: AppStoreListingGateway = {
  openListing: async () => {
    const url = StoreReview.storeUrl();
    if (!url) {
      throw new Error('App store listing URL is unavailable');
    }
    await Linking.openURL(url);
  },
};
