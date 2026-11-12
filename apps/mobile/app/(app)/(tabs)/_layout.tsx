import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useTranslation } from '@src/shared/i18n';
import { NATIVE_TAB_ICON_SOURCES } from '@src/shared/ui';
import { NativeTabs } from 'expo-router/native-tabs';
import { useResolveClassNames } from 'uniwind';

// 탭을 정하지 않은 링크(예: 탭 위 할 일 화면)는 할 일 탭 위에 연다
// 탭 그룹 이름은 탭의 영어 이름(To-dos·Memos·Me)이다. 탭이 정해지지 않은 링크(콜드 링크·탭 위 화면)는 Expo Router가 글자 순 첫 그룹에 열어, 탭마다 함께 쓰는 화면(`(me,memos,todos)`)은 마이 탭 `(me)`에 열린다
export const unstable_settings = {
  anchor: '(todos)',
};

export default function TabsLayout() {
  const haptics = useHaptics();
  const activeStyle = useResolveClassNames('text-main');
  const backgroundStyle = useResolveClassNames('bg-white');
  const inactiveStyle = useResolveClassNames('text-gray-6');
  const { t } = useTranslation();

  const handleTabPress = ({ data }: { data: { isPrevented: boolean } }) => {
    if (!data.isPrevented) {
      haptics.selection();
    }
  };

  return (
    <NativeTabs
      tintColor={activeStyle.color}
      iconColor={{ default: inactiveStyle.color, selected: activeStyle.color }}
      backgroundColor={backgroundStyle.backgroundColor}
      minimizeBehavior="never"
      // 펼친 화면·iPad에서 탭 바와 사이드바를 시스템이 고른다(iOS 27+)
      preferredPlacement="automatic"
    >
      <NativeTabs.Trigger name="(todos)" listeners={{ tabPress: handleTabPress }}>
        <NativeTabs.Trigger.Label>{t('tabs.todo')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.todo} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(memos)" listeners={{ tabPress: handleTabPress }}>
        <NativeTabs.Trigger.Label>{t('tabs.memo')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.memo} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(me)" listeners={{ tabPress: handleTabPress }}>
        <NativeTabs.Trigger.Label>{t('tabs.mypage')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.mypage} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
