import { AppleIcon, GoogleIcon, KakaoIcon, NaverIcon } from '@src/shared/ui';
import type { ReactNode } from 'react';
import type { OAuthProvider, OAuthProviderSlug } from '../../models/oauth.model';
import { OAUTH_PROVIDER_LABEL_KEYS } from './auth-provider-labels.constant';

interface ProviderConfig {
  provider: OAuthProvider;
  slug: OAuthProviderSlug;
  labelKey: (typeof OAUTH_PROVIDER_LABEL_KEYS)[OAuthProvider];
  icon: ReactNode;
  iconClassName: string;
}

export const PROVIDER_CONFIGS = [
  {
    provider: 'KAKAO',
    slug: 'kakao',
    labelKey: OAUTH_PROVIDER_LABEL_KEYS.KAKAO,
    icon: <KakaoIcon width={18} height={18} />,
    iconClassName: 'bg-yellow-300',
  },
  {
    provider: 'GOOGLE',
    slug: 'google',
    labelKey: OAUTH_PROVIDER_LABEL_KEYS.GOOGLE,
    icon: <GoogleIcon width={18} height={18} />,
    iconClassName: 'bg-white border border-gray-2',
  },
  {
    provider: 'APPLE',
    slug: 'apple',
    labelKey: OAUTH_PROVIDER_LABEL_KEYS.APPLE,
    icon: <AppleIcon width={18} height={18} colorClassName="text-white dark:text-black" />,
    iconClassName: 'bg-apple-button dark:bg-apple-button-dark',
  },
  {
    provider: 'NAVER',
    slug: 'naver',
    labelKey: OAUTH_PROVIDER_LABEL_KEYS.NAVER,
    icon: <NaverIcon width={18} height={18} colorClassName="text-white" />,
    iconClassName: 'bg-success',
  },
] as const satisfies readonly ProviderConfig[];
