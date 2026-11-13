import { useView } from '@src/shared/hooks/use-view';

import { invitedFriendsViewSchema } from '../schemas/invite-params.schema';

/** 초대한 친구 화면의 탭(`?view=`). 탭·화면·로딩이 같은 값을 읽는다 */
export function useInvitedFriendsView() {
  return useView('view', invitedFriendsViewSchema);
}
