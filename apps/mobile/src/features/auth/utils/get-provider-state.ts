import type { LinkedAccount, OAuthProvider, OAuthProviderSlug } from '../domains/oauth.model';

interface ProviderStateInput {
  accounts: readonly LinkedAccount[];
  provider: OAuthProvider;
  slug: OAuthProviderSlug;
  /** 연결 요청 중인 제공자 slug. 진행 중인 요청이 없으면 undefined */
  linkingSlug: OAuthProviderSlug | undefined;
  /** 해제 요청 중인 제공자. 진행 중인 요청이 없으면 undefined */
  unlinkingProvider: OAuthProvider | undefined;
}

/** 소셜 계정 행 하나의 연결 여부와 요청 진행 상태 */
export function getProviderState({
  accounts,
  provider,
  slug,
  linkingSlug,
  unlinkingProvider,
}: ProviderStateInput) {
  return {
    isLinked: accounts.find((account) => account.provider === provider)?.linked ?? false,
    isPending: linkingSlug === slug || unlinkingProvider === provider,
  };
}
