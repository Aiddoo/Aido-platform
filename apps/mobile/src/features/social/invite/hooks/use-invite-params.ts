import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useView } from '@src/shared/hooks/use-view';

import { inviteParamsSchema, invitedFriendsViewSchema } from '../schemas/invite-params.schema';

/** 초대 링크로 연 화면의 코드와 들어온 곳. 잘못된 코드는 null로 읽어 화면이 "찾을 수 없어요"를 보여 준다 */
export function useInviteParams() {
  const [params] = useRouteParams(inviteParamsSchema);

  return [params] as const;
}

/** 초대한 친구 화면의 탭(`?view=`). 탭·화면·로딩이 같은 값을 읽는다 */
export function useInvitedFriendsView() {
  return useView('view', invitedFriendsViewSchema);
}
