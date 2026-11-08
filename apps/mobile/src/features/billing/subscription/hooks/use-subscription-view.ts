import { useView } from '@src/shared/hooks/use-view';

import { subscriptionViewSchema } from '../schemas/subscription-params.schema';

export function useSubscriptionView() {
  const [view] = useView('view', subscriptionViewSchema);

  return [view] as const;
}
