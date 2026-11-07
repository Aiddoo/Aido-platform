import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useQuery } from '@tanstack/react-query';

/** 안내는 보조 기능이라 내 정보를 못 읽어도 던지지 않고, 읽기 전까지 null이다 */
export function useMyAccountId() {
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  return me?.id ?? null;
}
