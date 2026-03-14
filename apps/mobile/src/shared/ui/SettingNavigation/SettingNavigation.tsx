import { PressableFeedback } from 'heroui-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { ArrowRightIcon } from '../Icon';
import { ListRow } from '../ListRow';
import { VStack } from '../VStack';

export const SettingNavigationSection = ({ children }: PropsWithChildren) => (
  <VStack p={8} gap={8} className="bg-white rounded-2xl">
    {children}
  </VStack>
);

interface SettingNavigationItemProps {
  label: string;
  onPress: () => void;
  right?: ReactNode;
}

export const SettingNavigationItem = ({ label, onPress, right }: SettingNavigationItemProps) => (
  <PressableFeedback onPress={onPress} className="rounded-lg">
    <PressableFeedback.Highlight className="rounded-xl" />
    <ListRow
      contents={<ListRow.Texts type="1RowTypeA" top={label} />}
      right={right ?? <ArrowRightIcon colorClassName="text-gray-6" />}
      horizontalPadding="medium"
    />
  </PressableFeedback>
);
