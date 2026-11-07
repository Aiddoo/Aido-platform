import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { whatsNewParamsSchema } from '../schemas/whats-new-params.schema';

/** 새 소식 화면이 연 출시와 들어온 곳 */
export function useWhatsNewParams() {
  const [params] = useRouteParams(whatsNewParamsSchema);

  return [params] as const;
}
