import { View } from 'react-native';
import { Text } from './Text';
import type { H1Props, HeadingProps } from './Text.types';

export function H1({ headline, emphasize, className, children, ...props }: H1Props) {
  if (headline) {
    return (
      <View className={className}>
        <Text size="e1" weight="medium" tone="brand" className="mb-1">
          {headline}
        </Text>
        <Text
          {...props}
          size="h1"
          weight="bold"
          tone={emphasize ? 'brand' : 'neutral'}
          shade={emphasize ? undefined : 10}
          accessibilityRole="header"
        >
          {children}
        </Text>
      </View>
    );
  }

  return (
    <Text
      {...props}
      size="h1"
      weight="bold"
      tone={emphasize ? 'brand' : 'neutral'}
      shade={emphasize ? undefined : 10}
      className={className}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

export function H2({ emphasize, className, children, ...props }: HeadingProps) {
  return (
    <Text
      {...props}
      size="t1"
      weight="bold"
      tone={emphasize ? 'brand' : 'neutral'}
      shade={emphasize ? undefined : 10}
      className={className}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

export function H3({ emphasize, className, children, ...props }: HeadingProps) {
  return (
    <Text
      {...props}
      size="t2"
      weight="semibold"
      tone={emphasize ? 'brand' : 'neutral'}
      shade={emphasize ? undefined : 10}
      className={className}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

export function H4({ emphasize, className, children, ...props }: HeadingProps) {
  return (
    <Text
      {...props}
      size="t3"
      weight="semibold"
      tone={emphasize ? 'brand' : 'neutral'}
      shade={emphasize ? undefined : 9}
      className={className}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}
