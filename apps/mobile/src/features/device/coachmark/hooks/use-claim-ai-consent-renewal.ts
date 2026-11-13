import { useCompleteCoachmark } from './use-complete-coachmark';

/** AI 데이터 제공 동의 재안내는 보이면 끝나는 안내라 계정당 한 번만 자리를 잡는다. 잡았으면 true다 */
export function useClaimAiConsentRenewal() {
  const completeCoachmark = useCompleteCoachmark();

  return (accountId: string): boolean =>
    completeCoachmark({ accountId, kind: 'ai-consent-renewal' });
}
