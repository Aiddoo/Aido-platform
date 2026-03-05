import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import {
  AuthPolicy,
  type LinkedAccount,
  type OAuthProvider,
  type OAuthProviderSlug,
} from '../../models/oauth.model';
import { useGetLinkedAccountsQueryOptions } from '../queries/use-get-linked-accounts-query-options';
import { useLinkAccountMutationOptions } from '../queries/use-link-account-mutation-options';
import { useUnlinkAccountMutationOptions } from '../queries/use-unlink-account-mutation-options';

export function useLinkedAccounts() {
  const { data: accounts } = useSuspenseQuery<LinkedAccount[]>(useGetLinkedAccountsQueryOptions());
  const linkMutation = useMutation(useLinkAccountMutationOptions());
  const unlinkMutation = useMutation(useUnlinkAccountMutationOptions());

  const accountMap = new Map(accounts.map((account) => [account.provider, account]));
  const linkedCount = accounts.filter((account) => account.linked).length;

  const getProviderState = (provider: OAuthProvider, slug: OAuthProviderSlug) => ({
    isLinked: accountMap.get(provider)?.linked ?? false,
    isPending:
      (linkMutation.isPending && linkMutation.variables === slug) ||
      (unlinkMutation.isPending && unlinkMutation.variables === provider),
  });

  return {
    linkedCount,
    canUnlink: AuthPolicy.canUnlinkAccount(linkedCount),
    getProviderState,
    link: linkMutation.mutate,
    unlink: unlinkMutation.mutate,
  };
}
