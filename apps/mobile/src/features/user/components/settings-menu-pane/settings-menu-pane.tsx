import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { useTranslation } from '@src/shared/i18n';
import { H3, HStack, ScreenTitleBar, Spacing, StyledSafeAreaView } from '@src/shared/ui';
import { ScrollView } from 'react-native';

import { MyPageMenu } from '../mypage-menu/mypage-menu';

/** 펼친 화면에서 설정 상세 왼쪽에 항상 보이는 이동 목록이다. 접힌 마이페이지와 같은 헤더 자리를 둔다. */
export function SettingsMenuPane() {
  const { t } = useTranslation('user');

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['top', 'bottom']}>
      <StyledSafeAreaView edges={['left', 'right']}>
        <ScreenTitleBar
          title=""
          leading={<HStack className="size-11" />}
          trailing={<NotificationBell.Header />}
        />
      </StyledSafeAreaView>
      <ScrollView className="px-4 flex-1" contentContainerStyle={{ paddingBottom: 16 }}>
        <StyledSafeAreaView edges={['left', 'right']}>
          <H3>{t('mypage.header')}</H3>

          <Spacing size={20} />

          <MyPageMenu />
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
