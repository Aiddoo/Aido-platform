export { isStableFeedForeground } from '@src/shared/utils/stable-feed-foreground';

interface ClaimAndOpenFeatureDiscoveryInput {
  canAutoOpen: boolean;
  isStable: boolean;
  claim: () => boolean;
  open: () => void;
}

export function claimAndOpenFeatureDiscovery({
  canAutoOpen,
  isStable,
  claim,
  open,
}: ClaimAndOpenFeatureDiscoveryInput): boolean {
  if (!canAutoOpen || !isStable || !claim()) {
    return false;
  }

  open();
  return true;
}
