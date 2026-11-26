import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { nudgeParamsSchema } from '../schemas/nudge-params.schema';

/** `/nudges/[nudgeId]` 경로의 콕. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useNudgeId() {
  const [{ nudgeId }] = useRouteParams(nudgeParamsSchema);

  return [nudgeId] as const;
}
