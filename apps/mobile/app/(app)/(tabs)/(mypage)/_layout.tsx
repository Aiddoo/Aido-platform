import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { MyPageStack } from '@src/bootstrap/navigation/my-page-stack';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { Stack } from 'expo-router';

// 푸시·링크로 하위 화면을 바로 열어도 뒤로 가면 내 정보 메뉴가 나온다
export const unstable_settings = {
  anchor: 'mypage/index',
};

export default function MyPageTabLayout() {
  const isCompact = useWindowSizeClass() === 'compact';
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
      <Stack.Screen
        name="mypage/index"
        options={{ title: isCompact ? '' : t('user:mypage.header') }}
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
