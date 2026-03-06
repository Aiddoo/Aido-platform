import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { HStack } from '@src/shared/ui/HStack';
import { ArrowLeftIcon, EditIcon, MenuIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow';
import { Text } from '@src/shared/ui/Text';
import { router, Stack } from 'expo-router';
import { Popover, type PopoverTriggerRef, PressableFeedback } from 'heroui-native';
import { type ReactNode, useRef } from 'react';
import { InteractionManager, Pressable } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export default function FeedLayout() {
  const headerBg = useResolveClassNames('bg-white');
  const stackBg = useResolveClassNames('bg-gray-1');
  const settingsHeaderBg = useResolveClassNames('bg-gray-1');
  const settingsTitleColor = useResolveClassNames('text-gray-9');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTitle: '',
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        contentStyle: { backgroundColor: stackBg.backgroundColor as string },
        headerRight: () => (
          <HStack align="center">
            <FeedMenuPopover />
            <NotificationBell.Header />
          </HStack>
        ),
      }}
    >
      <Stack.Screen
        name="(feed)"
        options={{ contentStyle: { backgroundColor: headerBg.backgroundColor as string } }}
      />
      <Stack.Screen
        name="category-settings"
        options={{
          title: '내 카테고리',
          headerRight: () => null,
          headerStyle: { backgroundColor: settingsHeaderBg.backgroundColor as string },
          contentStyle: { backgroundColor: settingsHeaderBg.backgroundColor as string },
          headerTitleStyle: {
            fontSize: 16,
            fontWeight: '600',
            color: settingsTitleColor.color as string,
          },
          headerTitleAlign: 'center',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}

function FeedMenuPopover() {
  const popoverRef = useRef<PopoverTriggerRef>(null);

  const handleCategorySettings = () => {
    popoverRef.current?.close();
    InteractionManager.runAfterInteractions(() => {
      router.push('/feed/category-settings');
    });
  };

  return (
    <Popover>
      <Popover.Trigger ref={popoverRef} asChild>
        <Pressable hitSlop={8} className="p-2">
          <MenuIcon width={24} height={24} colorClassName="text-gray-8" />
        </Pressable>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Overlay />
        <Popover.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={180}
          className="rounded-2xl px-2 py-2 bg-white dark:bg-gray-1 shadow-sm border border-gray-1"
        >
          <PopoverMenuItem
            label="카테고리 관리"
            icon={<EditIcon width={20} height={20} colorClassName="text-gray-7" />}
            onPress={handleCategorySettings}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

interface PopoverMenuItemProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}

function PopoverMenuItem({ label, icon, onPress }: PopoverMenuItemProps) {
  return (
    <PressableFeedback onPress={onPress} className="rounded-xl">
      <PressableFeedback.Highlight className="rounded-xl" />
      <ListRow
        contents={
          <Text size="b3" weight="medium" shade={7}>
            {label}
          </Text>
        }
        right={icon}
        horizontalPadding="medium"
        className="bg-transparent"
      />
    </PressableFeedback>
  );
}
