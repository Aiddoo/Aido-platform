import { Tabs } from 'heroui-native';
import type { ComponentProps } from 'react';

import { Text } from '../text/text';

type TextTabTriggerProps = Omit<ComponentProps<typeof Tabs.Trigger>, 'children' | 'className'> & {
  children: string;
};

/** 밑줄 탭(`Tabs variant="secondary"`)의 글자 탭. heroui 라벨은 앱 글꼴을 따르지 않아 자식 Text로 넣는다 */
export function LineTabTrigger({ children, ...props }: TextTabTriggerProps) {
  return (
    <Tabs.Trigger {...props} className="py-3">
      {({ isSelected }) => (
        <Tabs.Label>
          <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
            {children}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
  );
}

/** 알약 탭(`Tabs variant="primary"`)의 글자 탭 */
export function SegmentTabTrigger({ children, ...props }: TextTabTriggerProps) {
  return (
    <Tabs.Trigger {...props}>
      {({ isSelected }) => (
        <Tabs.Label>
          <Text size="b4" weight={isSelected ? 'bold' : 'medium'} shade={isSelected ? 8 : 6}>
            {children}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
  );
}
