import { cn } from '@src/shared/utils/cn';
import { Tabs } from 'heroui-native';
import type { ComponentProps } from 'react';

import { Text } from '../text/text';
import type { TextProps } from '../text/text.types';

type TextTabTriggerProps = Omit<ComponentProps<typeof Tabs.Trigger>, 'children' | 'className'> &
  Pick<ComponentProps<typeof Tabs.Label>, 'numberOfLines'> & {
    children: string;
  };

type SegmentTabTriggerProps = TextTabTriggerProps & Pick<TextProps, 'size'>;

/** 밑줄 탭(`Tabs variant="secondary"`)의 글자 탭. heroui 라벨은 앱 글꼴을 따르지 않아 자식 Text로 넣는다 */
export function LineTabTrigger({ children, numberOfLines, ...props }: TextTabTriggerProps) {
  return (
    <Tabs.Trigger {...props} className="py-3">
      {({ isSelected }) => (
        <Tabs.Label numberOfLines={numberOfLines}>
          <Text size="b3" className={cn(isSelected ? 'text-main font-semibold' : 'text-gray-5')}>
            {children}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
  );
}

export function SegmentTabTrigger({
  children,
  numberOfLines,
  size = 'b4',
  ...props
}: SegmentTabTriggerProps) {
  return (
    <Tabs.Trigger {...props}>
      {({ isSelected }) => (
        <Tabs.Label numberOfLines={numberOfLines}>
          <Text size={size} weight={isSelected ? 'bold' : 'medium'} shade={isSelected ? 8 : 6}>
            {children}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
  );
}
