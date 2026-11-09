import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { whatsNewParamsSchema } from '../schemas/whats-new-params.schema';

export function useWhatsNewParams() {
  const [params] = useRouteParams(whatsNewParamsSchema);

  return [params] as const;
}
