import { useTheme } from '@src/shared/providers/theme-provider';
import { AppleIcon, GoogleIcon, KakaoIcon, NaverIcon } from '@src/shared/ui';
import type { ReactNode } from 'react';
import type { OAuthProvider, OAuthProviderSlug } from '../../models/oauth.model';

function ThemedAppleIcon() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return <AppleIcon width={18} height={18} colorClassName={isDark ? 'text-black' : 'text-white'} />;
}

interface ProviderConfig {
  provider: OAuthProvider;
  slug: OAuthProviderSlug;
  label: string;
  icon: ReactNode;
  iconClassName: string;
}

export const PROVIDER_CONFIGS = [
  {
    provider: 'KAKAO',
    slug: 'kakao',
    label: '카카오',
    icon: <KakaoIcon width={18} height={18} />,
    iconClassName: 'bg-yellow-300',
  },
  {
    provider: 'GOOGLE',
    slug: 'google',
    label: 'Google',
    icon: <GoogleIcon width={18} height={18} />,
    iconClassName: 'bg-white border border-gray-2',
  },
  {
    provider: 'APPLE',
    slug: 'apple',
    label: 'Apple',
    icon: <ThemedAppleIcon />,
    iconClassName: 'bg-gray-9 dark:bg-white',
  },
  {
    provider: 'NAVER',
    slug: 'naver',
    label: '네이버',
    icon: <NaverIcon width={18} height={18} colorClassName="text-white" />,
    iconClassName: 'bg-success',
  },
] as const satisfies readonly ProviderConfig[];
