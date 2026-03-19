import { PressableFeedback } from 'heroui-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { ArrowRightIcon } from '../Icon';
import { ListRow } from '../ListRow';
import { Text } from '../Text';
import { VStack } from '../VStack';

interface SettingNavigationProps extends PropsWithChildren {
  label?: string;
}

export function SettingNavigation({ label, children }: SettingNavigationProps) {
  return (
    <VStack p={8} gap={8} className="bg-white rounded-2xl">
      {label && (
        <Text size="b2" weight="semibold" className="px-4 pt-2" shade={9}>
          {label}
        </Text>
      )}
      {children}
    </VStack>
  );
}

interface SettingNavigationItemProps {
  label: string;
  onPress: () => void;
  right?: ReactNode;
}

SettingNavigation.Item = function Item({ label, onPress, right }: SettingNavigationItemProps) {
  return (
    <PressableFeedback onPress={onPress} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-xl" />
      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top={label} topProps={{ shade: 8 }} />}
        right={right ?? <ArrowRightIcon colorClassName="text-gray-6" />}
        horizontalPadding="medium"
      />
    </PressableFeedback>
  );
};
