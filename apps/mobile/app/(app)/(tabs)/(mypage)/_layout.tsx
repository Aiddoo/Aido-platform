import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { MyPageStack } from '@src/bootstrap/navigation/my-page-stack';
import { useTranslation } from '@src/shared/i18n';
import { IS_IPAD } from '@src/shared/infra/device/device-info';
import { PaneArea, StackHeaderTitle, usePaneSizeClass } from '@src/shared/ui';
import { Stack } from 'expo-router';

// 푸시·링크로 하위 화면을 바로 열어도 뒤로 가면 내 정보 메뉴가 나온다
export const unstable_settings = {
  anchor: 'mypage/index',
};

export default function MyPageTabLayout() {
  return (
    <PaneArea>
      <MyPageTabStack />
    </PaneArea>
  );
}

/** 메뉴 칸과 첫 화면 제목은 탭 사이드바를 뺀 폭으로 정하므로 `PaneArea` 안에서 그린다 */
function MyPageTabStack() {
  const isCompact = usePaneSizeClass() === 'compact';
  const { t } = useTranslation([
    'user',
    'settings',
    'notification',
    'friend',
    'invite',
    'achievement',
    'ai',
    'whatsNew',
  ]);

  return (
    <MyPageStack menu={<MyPageMenuPane />}>
      {/* iPadOS는 위 탭 바가 헤더에 있으면 탭 첫 화면의 제목 글자를 숨겨 헤더가 낮아지고, 메뉴를 고르면 메뉴 칸이 내려간다. 제목 뷰는 하위 화면 제목처럼 탭 바 아래 줄에 그린다 */}
      <Stack.Screen
        name="mypage/index"
        options={{
          title: isCompact ? '' : t('user:mypage.header'),
          ...(!isCompact && IS_IPAD && { headerTitle: StackHeaderTitle }),
        }}
      />

      <Stack.Screen name="friends/index" options={{ title: t('friend:screenTitle') }} />
      <Stack.Screen name="friends/search" options={{ title: t('friend:search.title') }} />
      <Stack.Screen name="friends/add" options={{ title: '' }} />
      <Stack.Screen name="friends/invite/index" options={{ title: t('invite:myInvite.title') }} />
      <Stack.Screen
        name="friends/invite/invitees"
        options={{ title: t('invite:friendList.title') }}
      />
      <Stack.Screen
        name="settings/blocked-users"
        options={{ title: t('settings:titles.blockedUsers') }}
      />

      <Stack.Screen name="achievements/index" options={{ title: t('achievement:titles.index') }} />
      <Stack.Screen
        name="achievements/[year]/[week]"
        options={{ title: t('achievement:titles.detail') }}
      />
      <Stack.Screen name="reports/index" options={{ title: t('ai:titles.reports') }} />
      <Stack.Screen name="reports/[reportId]" options={{ title: '' }} />

      <Stack.Screen
        name="settings/notifications/index"
        options={{ title: t('notification:titles.settings') }}
      />
      <Stack.Screen
        name="settings/notifications/push"
        options={{ title: t('notification:titles.push') }}
      />
      <Stack.Screen
        name="settings/notifications/weather"
        options={{ title: t('notification:titles.weather') }}
      />
      <Stack.Screen
        name="settings/notifications/reminder"
        options={{ title: t('notification:titles.reminder') }}
      />
      <Stack.Screen
        name="settings/category-settings"
        options={{ title: t('settings:titles.categorySettings') }}
      />
      <Stack.Screen name="settings/theme" options={{ title: t('settings:titles.theme') }} />
      <Stack.Screen name="settings/font-size" options={{ title: t('settings:titles.fontSize') }} />
      <Stack.Screen name="settings/language" options={{ title: t('settings:titles.language') }} />
      <Stack.Screen
        name="settings/voice-storage"
        options={{ title: t('settings:titles.voiceStorage') }}
      />

      <Stack.Screen
        name="settings/subscription"
        options={{ title: t('settings:titles.subscription') }}
      />
      <Stack.Screen name="settings/app-icon" options={{ title: t('settings:titles.appIcon') }} />

      <Stack.Screen name="whats-new/releases" options={{ title: t('whatsNew:list.title') }} />
      <Stack.Screen name="settings/inquiry" options={{ title: t('settings:titles.inquiry') }} />
      <Stack.Screen name="settings/terms" options={{ title: t('settings:titles.terms') }} />

      <Stack.Screen name="settings/profile" options={{ title: t('settings:titles.profile') }} />
      <Stack.Screen name="settings/edit-name" options={{ title: t('settings:titles.editName') }} />
      <Stack.Screen
        name="settings/change-password"
        options={{ title: t('settings:titles.changePassword') }}
      />
      <Stack.Screen
        name="settings/linked-accounts"
        options={{ title: t('settings:titles.linkedAccounts') }}
      />
      <Stack.Screen
        name="settings/delete-account"
        options={{ title: t('settings:titles.deleteAccount') }}
      />
    </MyPageStack>
  );
}
