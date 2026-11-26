import { useQuery } from '@tanstack/react-query';

import { useGetInviteAvailabilityQueryOptions } from '../queries/invite.queries';

/** 응답 전·실패 때는 숨겨서 꺼진 기능으로 들어가지 않게 한다 */
export function useIsInviteAvailable() {
  const { data: isAvailable = false } = useQuery({
    ...useGetInviteAvailabilityQueryOptions(),
    throwOnError: false,
  });

  return isAvailable;
}
