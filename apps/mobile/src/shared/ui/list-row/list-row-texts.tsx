import { Text, TextSkeleton, type TextProps, type TextSkeletonProps } from '@src/shared/ui/text';
import { VStack } from '@src/shared/ui/v-stack';
import type { ReactNode } from 'react';

interface ListRowTexts1RowType {
  top: ReactNode;
  topProps?: Omit<TextProps, 'children'>;
}

interface ListRowTextsOneLine extends ListRowTexts1RowType {
  type: 'oneLine';
}

interface ListRowTexts2RowType extends ListRowTexts1RowType {
  bottom: ReactNode;
  bottomProps?: Omit<TextProps, 'children'>;
}

interface ListRowTextsTwoLine extends ListRowTexts2RowType {
  type: 'twoLine';
}

export type ListRowTextsProps = ListRowTextsOneLine | ListRowTextsTwoLine;

export function ListRowTexts(props: ListRowTextsProps) {
  const { top, topProps } = props;

  return (
    <VStack gap={2} align="start">
      <Text size="b2" {...topProps}>
        {top}
      </Text>
      {props.type === 'twoLine' && (
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
      {type === 'twoLine' && <TextSkeleton size="e1" className="w-16" {...bottomProps} />}
    </VStack>
  );
};
