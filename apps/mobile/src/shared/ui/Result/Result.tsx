import { View } from 'react-native';
import { Button } from '../Button/Button';
import { Spacing } from '../Spacing/Spacing';
import { Text } from '../Text/Text';
import { VStack } from '../VStack/VStack';
import type { ResultButtonProps, ResultProps } from './Result.types';

function ResultRoot({ icon, title, description, button, className }: ResultProps) {
  return (
    <VStack align="center" justify="center" className={className} flex={1}>
      {icon && (
        <>
          <View accessible={false} importantForAccessibility="no">
            {icon}
          </View>
          <Spacing size={24} />
        </>
      )}

      <Text size="b3" shade={6} align="center">
        {title}
      </Text>

      {description && (
        <>
          <Spacing size={8} />
          <Text size="b4" shade={5} align="center">
            {description}
          </Text>
        </>
      )}

      {button && (
        <>
          <Spacing size={24} />
          {button}
        </>
      )}
    </VStack>
  );
}

function ResultButton({ children, color = 'dark', className, ...props }: ResultButtonProps) {
  return (
    <Button size="medium" color={color} display="inline" className={className} {...props}>
      {children}
    </Button>
  );
}

export const Result = Object.assign(ResultRoot, {
  Button: ResultButton,
});
