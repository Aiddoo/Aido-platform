import { Text } from './text';
import type { TextProps } from './text.types';

export function H1(props: TextProps) {
  return (
    <Text {...props} size="h1" weight="bold" tone="neutral" shade={10} accessibilityRole="header" />
  );
}

export function H2(props: TextProps) {
  return (
    <Text {...props} size="t1" weight="bold" tone="neutral" shade={10} accessibilityRole="header" />
  );
}

export function H3(props: TextProps) {
  return (
    <Text
      {...props}
      size="t2"
      weight="semibold"
      tone="neutral"
      shade={10}
      accessibilityRole="header"
    />
  );
}

export function H4(props: TextProps) {
  return (
    <Text
      {...props}
      size="t3"
      weight="semibold"
      tone="neutral"
      shade={9}
      accessibilityRole="header"
    />
  );
}
