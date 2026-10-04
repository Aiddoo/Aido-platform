import { nudgeDirectionSchema } from '@src/features/todo/models/nudge-interaction.model';
import { NudgeList } from '@src/features/todo/presentations/components/nudge-interactions/NudgeList';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ScreenTitleBar, StyledSafeAreaView, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense, type ComponentProps } from 'react';
import { z } from 'zod';

const NudgeSearchSchema = z.object({ direction: nudgeDirectionSchema.catch('received') });

export default function NudgesScreen() {
  const { direction } = NudgeSearchSchema.parse(useLocalSearchParams());
  const { t } = useTranslation('todo');

  return (
    <StyledSafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScreenTitleBar
        title={t('interaction.title')}
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      />
      <Tabs
        value={direction}
        onValueChange={(value) => {
          const parsed = nudgeDirectionSchema.safeParse(value);
          if (parsed.success) router.setParams({ direction: parsed.data });
        }}
        variant="secondary"
        className="flex-1"
      >
        <Tabs.List className="border-b border-gray-2 w-full">
          <Tabs.Indicator className="h-[2px]" />
          <NudgeTab value="received">{t('interaction.received')}</NudgeTab>
          <NudgeTab value="sent">{t('interaction.sent')}</NudgeTab>
        </Tabs.List>
        <Tabs.Content value={direction} className="flex-1">
          <QueryErrorBoundary resetKeys={[direction]} fallback={NudgeList.Error}>
            <Suspense fallback={<NudgeList.Loading />}>
              <NudgeList direction={direction} />
            </Suspense>
          </QueryErrorBoundary>
        </Tabs.Content>
      </Tabs>
    </StyledSafeAreaView>
  );
}

function NudgeTab({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Tabs.Trigger>, 'children'> & { children: string }) {
  return (
    <Tabs.Trigger {...props} className={cn('py-3', className)}>
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
