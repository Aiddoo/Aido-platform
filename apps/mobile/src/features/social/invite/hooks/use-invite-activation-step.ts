import { useQuery } from '@tanstack/react-query';

import { InvitePolicy } from '../domains/invite.model';
import { useGetInviteQueryOptions } from '../queries/get-invite-query-options';
import { useInviteAvailability } from './use-invite-availability';

/** 시작 체크리스트의 친구 초대 단계. 초대 기능이 켜졌을 때만 보이고, 한 명이라도 가입하면 끝난다 */
export function useInviteActivationStep() {
  const isAvailable = useInviteAvailability();
  // 초대 요약은 기능이 켜진 걸 확인한 뒤에만 부른다(꺼져 있으면 서버가 거절한다)
  const { data: invite } = useQuery({
    ...useGetInviteQueryOptions(),
    enabled: isAvailable,
    throwOnError: false,
  });

  return {
    isVisible: isAvailable,
    isCompleted: invite != null && InvitePolicy.hasInvitedAnyone(invite),
  };
}
