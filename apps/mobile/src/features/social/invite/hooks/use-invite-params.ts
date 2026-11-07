import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { inviteParamsSchema } from '../schemas/invite-params.schema';

/** 초대 링크로 연 화면의 코드와 들어온 곳. 잘못된 코드는 null로 읽어 화면이 "찾을 수 없어요"를 보여 준다 */
export function useInviteParams() {
  const [params] = useRouteParams(inviteParamsSchema);

  return [params] as const;
}
