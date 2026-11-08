import { useCoachmarkService } from '@src/bootstrap/providers/di-context';

export function useClaimAiConsentRenewal() {
  const coachmarkService = useCoachmarkService();

  return (accountId: string): boolean =>
    coachmarkService.claim({ accountId, kind: 'ai-consent-renewal' });
}
