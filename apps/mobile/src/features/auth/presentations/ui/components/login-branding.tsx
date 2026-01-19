import { H1, Text } from '@src/core/component/ui/Text';
import { VStack } from '@src/core/component/ui/VStack';
import type { ImageSourcePropType } from 'react-native';
import { Image } from 'react-native';

interface LoginBrandingProps {
  logo: ImageSourcePropType;
  title: string;
  tagline: string;
}

export const LoginBranding = ({ logo, title, tagline }: LoginBrandingProps) => {
  return (
    <VStack flex={1} align="center" justify="center" gap={8}>
      <Image source={logo} className="w-20 h-20 rounded-2xl" />
      <VStack align="center">
        <H1>{title}</H1>
        <Text size="b4" shade={6}>
          {tagline}
        </Text>
      </VStack>
    </VStack>
  );
};
