export const INVITE_MUTATION_KEYS = {
  all: ['invite', 'mutation'] as const,
  checkInvitePreview: () => [...INVITE_MUTATION_KEYS.all, 'check-invite-preview'] as const,
  redeemInvite: () => [...INVITE_MUTATION_KEYS.all, 'redeem-invite'] as const,
  rotateInviteCode: () => [...INVITE_MUTATION_KEYS.all, 'rotate-invite-code'] as const,
  shareInvite: () => [...INVITE_MUTATION_KEYS.all, 'share-invite'] as const,
} as const;
