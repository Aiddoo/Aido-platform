export type FeatureDiscoveryConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly campaignId: string;
      readonly minAppVersion: string;
      readonly launchedAt: string;
      readonly autoOpen: boolean;
    };
