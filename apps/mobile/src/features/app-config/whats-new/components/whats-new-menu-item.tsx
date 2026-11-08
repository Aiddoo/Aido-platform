import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, InfoIcon, SettingsListGroup } from '@src/shared/ui';
import { router } from 'expo-router';

import { useHasUnseenRelease } from '../hooks/use-has-unseen-release';

/** 마이 메뉴에서 출시 목록을 언제나 연다. 최신 출시를 안 봤으면 점을 단다 */
export function WhatsNewMenuItem() {
  const { t } = useTranslation('whatsNew');
  const push = useSingleTap(router.push);
  const hasUnseenRelease = useHasUnseenRelease();
  const label = t('entry.mypage');

  return (
    <SettingsListGroup.Item
      testID="whats-new-open"
      icon={<SettingsListGroup.Icon Icon={InfoIcon} />}
      label={label}
      accessibilityLabel={hasUnseenRelease ? `${label}, ${t('list.unseenLabel')}` : label}
      value={
        hasUnseenRelease ? (
          <Box testID="whats-new-unseen-dot" className="size-2 rounded-full bg-main" />
        ) : undefined
      }
      onPress={() => push('/whats-new/releases')}
    />
  );
}
