import { Text } from '@src/shared/ui/Text/Text';
import type { TextProps } from '@src/shared/ui/Text/Text.types';
import { VStack } from '@src/shared/ui/VStack/VStack';
import type { ReactNode } from 'react';

interface ListRowTexts1RowType {
  top: ReactNode;
  topProps?: Omit<TextProps, 'children'>;
}

interface ListRowTexts1RowTypeA extends ListRowTexts1RowType {
  type: '1RowTypeA';
}

interface ListRowTexts2RowType extends ListRowTexts1RowType {
  bottom: ReactNode;
  bottomProps?: Omit<TextProps, 'children'>;
}

interface ListRowTexts2RowTypeA extends ListRowTexts2RowType {
  type: '2RowTypeA';
}

interface ListRowTexts3RowType extends ListRowTexts2RowType {
  middle: ReactNode;
  middleProps?: Omit<TextProps, 'children'>;
}

interface ListRowTexts3RowTypeA extends ListRowTexts3RowType {
  type: '3RowTypeA';
}

export type ListRowTextsProps =
  | ListRowTexts1RowTypeA
  | ListRowTexts2RowTypeA
  | ListRowTexts3RowTypeA;

export const ListRowTexts = (props: ListRowTextsProps) => {
  const { type, top, topProps } = props;

  return (
    <VStack gap={2} align="start">
      <Text size="b2" {...topProps}>
        {top}
      </Text>
      {(type === '2RowTypeA' || type === '3RowTypeA') && (
        <>
          {type === '3RowTypeA' && (
            <Text size="b3" shade={6} {...props.middleProps}>
              {props.middle}
            </Text>
          )}
          <Text size="e1" shade={5} {...props.bottomProps}>
            {props.bottom}
          </Text>
        </>
      )}
    </VStack>
  );
};
