import type { CustomerInfo } from 'react-native-purchases';

type EntitlementInfo = CustomerInfo['entitlements']['active'][string];

interface StoreEntitlements {
  active: Record<string, Pick<EntitlementInfo, 'store'>>;
}

export const CustomerInfoPolicy = {
  /** 스토어에서 실제로 결제한 엔타이틀먼트가 있는지 본다. 보상(PROMOTIONAL)은 복원할 구매가 아니다. */
  hasStoreEntitlement(entitlements: StoreEntitlements) {
    return Object.values(entitlements.active).some(
      (entitlement) => entitlement.store !== 'PROMOTIONAL',
    );
  },
};
