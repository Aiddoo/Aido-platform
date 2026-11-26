import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';

export function usePromptSuggestionLimit(): (error: unknown) => void {
  const haptics = useHaptics();
  const gate = useEntitlementGate('AI_SUGGESTION', { surface: 'suggestions' });

  return (error) => {
    if (gate.promptIfBlockedError(error)) {
      haptics.notify('error');
    }
  };
}
