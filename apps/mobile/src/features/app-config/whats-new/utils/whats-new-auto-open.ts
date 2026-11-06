interface ClaimAndOpenWhatsNewInput {
  canAutoOpen: boolean;
  isStable: boolean;
  claim: () => boolean;
  open: () => void;
}

export function claimAndOpenWhatsNew({
  canAutoOpen,
  isStable,
  claim,
  open,
}: ClaimAndOpenWhatsNewInput): boolean {
  if (!canAutoOpen || !isStable || !claim()) {
    return false;
  }

  open();
  return true;
}
