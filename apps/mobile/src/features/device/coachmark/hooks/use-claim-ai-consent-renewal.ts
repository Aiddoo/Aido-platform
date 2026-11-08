import { useCoachmarkService } from '@src/bootstrap/providers/di-context';

/** AI 데이터 제공 동의 재안내를 계정당 한 번만 보이도록 자리를 잡는다. 잡았으면 true다 */
export function useClaimAiConsentRenewal() {
  const coachmarkService = useCoachmarkService();

  return (accountId: string): boolean =>
    coachmarkService.claim({ accountId, kind: 'ai-consent-renewal' });
}
