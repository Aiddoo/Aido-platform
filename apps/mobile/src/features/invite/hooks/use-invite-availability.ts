import { useQuery } from '@tanstack/react-query';

import { useGetInviteAvailabilityQueryOptions } from '../queries/get-invite-availability-query-options';

/**
 * 초대 진입점을 보여도 되는지. 모든 진입점이 이 플래그 하나로 숨고 나타난다.
 * 응답 전·실패 때는 숨겨서 꺼진 기능으로 들어가지 않게 한다.
 */
export function useInviteAvailability() {
  const { data: isAvailable = false } = useQuery({
    ...useGetInviteAvailabilityQueryOptions(),
    throwOnError: false,
  });

  return isAvailable;
}
