import { Flex } from '../flex/flex';
import type { HStackProps } from './h-stack.types';

export function HStack(props: HStackProps) {
  return <Flex direction="row" {...props} />;
}
