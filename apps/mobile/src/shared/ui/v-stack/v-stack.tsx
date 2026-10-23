import { Flex } from '../flex/flex';
import type { VStackProps } from './v-stack.types';

export function VStack(props: VStackProps) {
  return <Flex direction="column" {...props} />;
}
