import { useTranslation } from '@src/shared/i18n';
import * as Haptics from 'expo-haptics';
import { NativeTabs } from 'expo-router/native-tabs';
import { useResolveClassNames } from 'uniwind';

export default function TabsLayout() {
  const activeStyle = useResolveClassNames('text-main');
  const backgroundStyle = useResolveClassNames('bg-white');
  const { t } = useTranslation();

  return (
    <NativeTabs
      tintColor={activeStyle.color}
      backgroundColor={backgroundStyle.backgroundColor}
      minimizeBehavior="onScrollDown"
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
        <NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
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
        <NativeTabs.Trigger.Icon sf="note.text" md="description" />
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
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
