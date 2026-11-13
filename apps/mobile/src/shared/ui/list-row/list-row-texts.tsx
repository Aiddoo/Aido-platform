import type { ReactNode } from 'react';

import { Text } from '../text/text';
import { TextSkeleton, type TextSkeletonProps } from '../text/text-skeleton';
import { type TextProps } from '../text/text.types';
import { VStack } from '../v-stack/v-stack';

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

export function ListRowTexts(props: ListRowTextsProps) {
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
}

interface ListRowTextsLoadingProps {
  type: ListRowTextsProps['type'];
  topProps?: TextSkeletonProps;
  middleProps?: TextSkeletonProps;
  bottomProps?: TextSkeletonProps;
}

ListRowTexts.Loading = function Loading({
  type,
  topProps,
  middleProps,
  bottomProps,
}: ListRowTextsLoadingProps) {
  return (
    <VStack gap={2} align="start">
      <TextSkeleton size="b2" className="w-24" {...topProps} />
      {type === '3RowTypeA' && <TextSkeleton size="b3" className="w-32" {...middleProps} />}
      {type !== '1RowTypeA' && <TextSkeleton size="e1" className="w-16" {...bottomProps} />}
    </VStack>
  );
};
