import AppleIcon from '@assets/icons/ic_apple.svg';
import GoogleIcon from '@assets/icons/ic_google.svg';
import KakaoIcon from '@assets/icons/ic_kakao.svg';
import NaverIcon from '@assets/icons/ic_naver.svg';
import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Button } from 'heroui-native';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

export type SocialProvider = 'kakao' | 'apple' | 'google' | 'naver';

interface ProviderConfig {
  icon: ComponentType<SvgProps>;
  label: string;
  bgColor: string;
  textColor: string;
  iconSize: number;
}

const PROVIDER_CONFIG: Record<SocialProvider, ProviderConfig> = {
  kakao: {
    icon: KakaoIcon,
    label: '카카오로 계속하기',
    bgColor: 'bg-[#FEE500]',
    textColor: 'text-[#3C1E1E]',
    iconSize: 20,
  },
  apple: {
    icon: AppleIcon,
    label: 'Apple로 계속하기',
    bgColor: 'bg-black',
    textColor: 'text-white',
    iconSize: 18,
  },
  google: {
    icon: GoogleIcon,
    label: 'Google로 계속하기',
    bgColor: 'bg-white border border-gray-200',
    textColor: 'text-black',
    iconSize: 24,
  },
  naver: {
    icon: NaverIcon,
    label: '네이버로 계속하기',
    bgColor: 'bg-[#03C75A]',
    textColor: 'text-white',
    iconSize: 20,
  },
};

interface PrimaryLogin {
  provider: SocialProvider;
  onPress: () => void;
  loading?: boolean;
}

interface SocialLoginGroupProps {
  primary: PrimaryLogin[];
  secondary: SocialProvider[];
  onSecondaryPress: (provider: SocialProvider) => void;
}

export const SocialLoginGroup = ({
  primary,
  secondary,
  onSecondaryPress,
}: SocialLoginGroupProps) => {
  return (
    <VStack gap={12}>
      {primary.map(({ provider, onPress, loading }) => {
        const config = PROVIDER_CONFIG[provider];
        const Icon = config.icon;

        return (
          <Button key={provider} onPress={onPress} isDisabled={loading} className={config.bgColor}>
            <HStack align="center" gap={8}>
              <Icon width={config.iconSize} height={config.iconSize} />
              <Button.Label className={config.textColor}>
                {loading ? '로그인 중...' : config.label}
              </Button.Label>
            </HStack>
          </Button>
        );
      })}

      <HStack align="center" my={24} gap={12}>
        <Box flex={1} className="h-px bg-gray-200" />
        <Text tone="neutral" shade={5} size="e1">
          또는
        </Text>
        <Box flex={1} className="h-px bg-gray-200" />
      </HStack>

      <HStack justify="center" gap={16}>
        {secondary.map((provider) => {
          const config = PROVIDER_CONFIG[provider];
          const Icon = config.icon;

          return (
            <Button
              key={provider}
              isIconOnly
              variant="ghost"
              onPress={() => onSecondaryPress(provider)}
              className={`w-14 h-14 rounded-full ${config.bgColor}`}
            >
              <Icon width={config.iconSize} height={config.iconSize} />
            </Button>
          );
        })}
      </HStack>
    </VStack>
  );
};
