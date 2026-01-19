import { HStack } from '@src/core/component/ui/HStack';
import { Text } from '@src/core/component/ui/Text';
import { Button } from 'heroui-native';

interface FooterLink {
  label: string;
  onPress: () => void;
}

interface LoginFooterProps {
  links: FooterLink[];
}

export const LoginFooter = ({ links }: LoginFooterProps) => {
  return (
    <HStack justify="center" mt={24} align="center">
      {links.map((link, index) => (
        <HStack key={link.label} align="center">
          {index > 0 && (
            <Text shade={3} size="b4">
              |
            </Text>
          )}
          <Button variant="ghost" size="sm" onPress={link.onPress}>
            <Text shade={5} size="b4">
              {link.label}
            </Text>
          </Button>
        </HStack>
      ))}
    </HStack>
  );
};
