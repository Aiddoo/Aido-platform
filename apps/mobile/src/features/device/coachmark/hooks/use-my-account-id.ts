import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useQuery } from '@tanstack/react-query';

export function useMyAccountId() {
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  return me?.id ?? null;
}
