import { Flex } from '../Flex/Flex';
import type { VStackProps } from './VStack.types';

export function VStack(props: VStackProps) {
  return <Flex direction="column" {...props} />;
}
