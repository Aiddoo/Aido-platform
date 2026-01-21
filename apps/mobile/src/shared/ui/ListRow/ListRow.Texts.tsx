import { Text } from '../Text/Text';
import { VStack } from '../VStack/VStack';
import type { ListRowTextsProps } from './ListRow.types';

export function ListRowTexts({
  type = '1Row',
  top,
  topProps,
  middle,
  middleProps,
  bottom,
  bottomProps,
}: ListRowTextsProps) {
  const isRight = type.startsWith('Right');
  const align = isRight ? 'right' : 'left';
  const rowCount = type.replace('Right', '').charAt(0);

  return (
    <VStack gap={2} align={isRight ? 'end' : 'start'}>
      <Text size="b2" align={align} {...topProps}>
        {top}
      </Text>
      {(rowCount === '2' || rowCount === '3') && middle && (
        <Text size="b3" shade={6} align={align} {...middleProps}>
          {middle}
        </Text>
      )}
      {rowCount === '3' && bottom && (
        <Text size="e1" shade={5} align={align} {...bottomProps}>
          {bottom}
        </Text>
      )}
    </VStack>
  );
}
