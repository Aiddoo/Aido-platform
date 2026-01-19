import { Flex } from '../Flex/Flex';
import type { HStackProps } from './HStack.types';

export function HStack(props: HStackProps) {
  return <Flex direction="row" {...props} />;
}
