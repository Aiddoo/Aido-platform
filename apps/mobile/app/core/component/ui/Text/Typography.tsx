import { View } from 'react-native';
import { Text } from './Text';
import type { H1Props, HeadingProps, TextProps } from './Text.types';

export function H1({ headline, emphasize, className, children, ...props }: H1Props) {
  if (headline) {
    return (
      <View className={className}>
        <Text size="e1" weight="medium" color="accent" className="mb-1">
          {headline}
        </Text>
        <Text
          {...props}
          size="h1"
          weight="bold"
          color={emphasize ? 'accent' : 'gray-10'}
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
      color={emphasize ? 'accent' : 'gray-10'}
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
      color={emphasize ? 'accent' : 'gray-10'}
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
      color={emphasize ? 'accent' : 'gray-10'}
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
      color={emphasize ? 'accent' : 'gray-9'}
      className={className}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

export function Paragraph({ className, children, ...props }: TextProps) {
  return (
    <Text {...props} size="b1" color="gray-8" className={className}>
      {children}
    </Text>
  );
}

export function Caption({ className, children, ...props }: TextProps) {
  return (
    <Text {...props} size="e1" color="gray-6" className={className}>
      {children}
    </Text>
  );
}

export function Label({ className, children, ...props }: TextProps) {
  return (
    <Text {...props} size="b4" className={className}>
      {children}
    </Text>
  );
}
