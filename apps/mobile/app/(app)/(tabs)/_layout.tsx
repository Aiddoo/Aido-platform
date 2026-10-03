import { useTranslation } from '@src/shared/i18n';
import { NATIVE_TAB_ICON_SOURCES } from '@src/shared/ui';
import * as Haptics from 'expo-haptics';
import { NativeTabs } from 'expo-router/native-tabs';
import { useResolveClassNames } from 'uniwind';

export default function TabsLayout() {
  const activeStyle = useResolveClassNames('text-main');
  const backgroundStyle = useResolveClassNames('bg-white');
  const inactiveStyle = useResolveClassNames('text-gray-6');
  const { t } = useTranslation();

  return (
    <NativeTabs
      tintColor={activeStyle.color}
      iconColor={{ default: inactiveStyle.color, selected: activeStyle.color }}
      backgroundColor={backgroundStyle.backgroundColor}
      minimizeBehavior="never"
    >
      <NativeTabs.Trigger
        name="feed"
        listeners={{
          tabPress: ({ data }) => {
            if (!data.isPrevented) void Haptics.selectionAsync();
          },
        }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.todo')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.todo} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="memo"
        listeners={{
          tabPress: ({ data }) => {
            if (!data.isPrevented) void Haptics.selectionAsync();
          },
        }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.memo')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.memo} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="mypage"
        listeners={{
          tabPress: ({ data }) => {
            if (!data.isPrevented) void Haptics.selectionAsync();
          },
        }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.mypage')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.mypage} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
