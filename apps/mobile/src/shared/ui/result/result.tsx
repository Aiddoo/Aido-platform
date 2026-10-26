import { Box } from '../box';
import { Button } from '../button/button';
import { Spacing } from '../spacing/spacing';
import { Text } from '../text/text';
import { VStack } from '../v-stack/v-stack';
import type { ResultButtonProps, ResultProps } from './result.types';

export function Result({ icon, title, description, button, className, testID }: ResultProps) {
  return (
    <VStack align="center" justify="center" className={className} flex={1} testID={testID}>
      {icon && (
        <>
          <Box accessible={false} importantForAccessibility="no">
            {icon}
          </Box>
          <Spacing size={24} />
        </>
      )}

      <Text
        size="b3"
        shade={6}
        align="center"
        weight="medium"
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="highQuality"
      >
        {title}
      </Text>

      {description && (
        <>
          <Spacing size={4} />
          <Text
            size="b4"
            shade={5}
            align="center"
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="highQuality"
          >
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

Result.Button = function ResultButton({
  children,
  color = 'dark',
  className,
  ...props
}: ResultButtonProps) {
  return (
    <Button size="medium" color={color} display="inline" className={className} {...props}>
      {children}
    </Button>
  );
};
