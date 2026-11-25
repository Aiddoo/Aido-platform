import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';

/** 제안 처리가 한도·요금제로 거절되면 결제 안내를 띄우고 오류 햅틱을 준다. 수락 시트와 거절 버튼이 함께 쓴다 */
export function usePromptSuggestionLimit(): (error: unknown) => void {
  const haptics = useHaptics();
  const gate = useEntitlementGate('AI_SUGGESTION', { surface: 'suggestions' });

  return (error) => {
    if (gate.promptIfBlockedError(error)) {
      haptics.notify('error');
    }
  };
}
