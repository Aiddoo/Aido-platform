import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import {
  AuthPolicy,
  type LinkedAccount,
  type OAuthProvider,
  type OAuthProviderSlug,
} from '../../models/oauth.model';
import { getLinkedAccountsQueryOptions } from '../queries/get-linked-accounts-query-options';
import { linkAccountMutationOptions } from '../queries/link-account-mutation-options';
import { unlinkAccountMutationOptions } from '../queries/unlink-account-mutation-options';

export function useLinkedAccounts() {
  const { data: accounts } = useSuspenseQuery<LinkedAccount[]>(getLinkedAccountsQueryOptions());
  const linkMutation = useMutation(linkAccountMutationOptions());
  const unlinkMutation = useMutation(unlinkAccountMutationOptions());

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
