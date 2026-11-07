import { Text, TextSkeleton, type TextProps, type TextSkeletonProps } from '@src/shared/ui/text';
import { VStack } from '@src/shared/ui/v-stack';
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

export type ListRowTextsProps = ListRowTexts1RowTypeA | ListRowTexts2RowTypeA;

export function ListRowTexts(props: ListRowTextsProps) {
  const { top, topProps } = props;

  return (
    <VStack gap={2} align="start">
      <Text size="b2" {...topProps}>
        {top}
      </Text>
      {props.type === '2RowTypeA' && (
        <Text size="e1" shade={5} {...props.bottomProps}>
          {props.bottom}
        </Text>
      )}
    </VStack>
  );
}

interface ListRowTextsLoadingProps {
  type: ListRowTextsProps['type'];
  topProps?: TextSkeletonProps;
  bottomProps?: TextSkeletonProps;
}

ListRowTexts.Loading = function Loading({ type, topProps, bottomProps }: ListRowTextsLoadingProps) {
  return (
    <VStack gap={2} align="start">
      <TextSkeleton size="b2" className="w-24" {...topProps} />
      {type === '2RowTypeA' && <TextSkeleton size="e1" className="w-16" {...bottomProps} />}
    </VStack>
  );
};
