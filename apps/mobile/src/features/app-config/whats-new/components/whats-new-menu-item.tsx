import {
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useTranslation } from '@src/shared/i18n';
import { Box, SettingsListGroup, WhatsNewDuoIcon } from '@src/shared/ui';

import { useUnseenCampaignReleaseId } from '../hooks/use-unseen-campaign-release-id';

const RELEASES_PATHNAME = '/whats-new/releases';

/** 다른 메뉴처럼 넓은 화면에서는 오른쪽 칸을 이 화면 하나로 바꾼다 */
export function WhatsNewMenuItem() {
  const { t } = useTranslation('whatsNew');
  const navigate = useMyPageMenuNavigate();
  const isSelected = useIsMyPageMenuItemSelected(RELEASES_PATHNAME);
  const hasUnseenRelease = useUnseenCampaignReleaseId() != null;
  const label = t('entry.mypage');

  return (
    <SettingsListGroup.Item
      testID="whats-new-open"
      icon={<SettingsListGroup.Icon Icon={WhatsNewDuoIcon} />}
      label={label}
      accessibilityLabel={hasUnseenRelease ? `${label}, ${t('list.unseenLabel')}` : label}
      isSelected={isSelected}
      value={
        hasUnseenRelease ? (
          <Box testID="whats-new-unseen-dot" className="size-2 rounded-full bg-main" />
        ) : undefined
      }
      onPress={() => navigate(RELEASES_PATHNAME)}
    />
  );
}
