import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { APP_ICONS } from '@src/shared/constants/app-icons';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CrownFilledIcon,
  Image,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  SettingsListGroup,
  useConfirmDialog,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { RadioGroup, Skeleton } from 'heroui-native';
import { Fragment } from 'react';

import { type AppIconKey, AppIconPolicy } from '../domains/app-icon.model';
import { useChangeAppIconMutationOptions } from '../queries/app-icon.mutations';
import { useGetCurrentAppIconQueryOptions } from '../queries/app-icon.queries';

const THUMBNAIL_SIZE = 40;
// 18pt 잠금 배지 안에 맞춘 크기라 아이콘 단계(12~)보다 작다
const LOCK_BADGE_ICON_SIZE = 10;

export function AppIconSelector() {
  const { t } = useTranslation(['appIcon', 'common']);
  const [{ data: currentIcon }, { data: entitlements }] = useSuspenseQueries({
    queries: [useGetCurrentAppIconQueryOptions(), useGetEntitlementsQueryOptions()],
  });
  const { mutate: changeIcon, isPending: isChanging } = useMutation(
    useChangeAppIconMutationOptions(),
  );
  const confirmDialog = useConfirmDialog();
  const gate = useEntitlementGate('APP_ICON', { surface: 'app_icon_settings' });
  const canUseAppIcon = EntitlementPolicy.canUseFeature(entitlements, 'APP_ICON');

  // 고르기는 한 번에 하나다(바꾸는 중에는 그룹이 꺼진다). 줄마다 따로 도는 동작과 달리 가드 하나를 함께 쓴다
  const startChange = useSingleTap(async (key: AppIconKey) => {
    if (AppIconPolicy.isPremiumIcon(key) && gate.promptIfBlocked()) {
      return;
    }

    // Android는 아이콘을 바꾸면 앱이 다시 시작돼 먼저 묻는다
    if (process.env.EXPO_OS === 'android') {
      const isConfirmed = await confirmDialog.openAsync({
        title: t('restartDialog.title'),
        description: t('restartDialog.description'),
        confirmLabel: t('restartDialog.confirm'),
        cancelLabel: t('common:actions.cancel'),
      });
      if (!isConfirmed) {
        return;
      }
    }
    changeIcon(key);
  });

  // 줄과 그 안의 라디오 원 모두 그룹의 onValueChange로 알린다
  const handleValueChange = (value: string) => {
    const icon = APP_ICONS.find(({ key }) => key === value);
    // 지금 아이콘을 누른 것은 아무 일도 하지 않아 가드에 넣지 않는다. 바로 뒤 다른 줄 누름이 막히지 않는다
    if (icon == null || isChanging || icon.key === currentIcon) {
      return;
    }
    startChange(icon.key);
  };

  return (
    <RadioGroup
      value={currentIcon}
      onValueChange={handleValueChange}
      isDisabled={isChanging}
      className="gap-0"
    >
      {APP_ICONS.map((icon, index) => (
        <Fragment key={icon.key}>
          {index > 0 && <SettingsListGroup.Separator />}
          <SettingsListGroup.Radio
            value={icon.key}
            label={t(icon.labelKey)}
            icon={
              <AppIconThumbnail
                source={icon.preview}
                isLocked={!canUseAppIcon && AppIconPolicy.isPremiumIcon(icon.key)}
              />
            }
          />
        </Fragment>
      ))}
    </RadioGroup>
  );
}

interface AppIconThumbnailProps {
  source: (typeof APP_ICONS)[number]['preview'];
  isLocked: boolean;
}

function AppIconThumbnail({ source, isLocked }: AppIconThumbnailProps) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(THUMBNAIL_SIZE);

  return (
    <Box accessible={false} importantForAccessibility="no">
      <Image
        source={source}
        contentFit="cover"
        // 앱 아이콘 모서리 비율(THUMBNAIL_SIZE 40의 1/4)에 맞춘 값이라 모서리 단계(8·12)로 옮기지 않는다
        className="rounded-[10px]"
        style={{ width: size, height: size }}
      />
      {isLocked && (
        <Box className="absolute -top-1 -right-1 size-[18px] items-center justify-center rounded-full border border-gray-1 bg-gray-8 dark:bg-gray-2">
          <CrownFilledIcon
            width={fontScaledSize(LOCK_BADGE_ICON_SIZE)}
            height={fontScaledSize(LOCK_BADGE_ICON_SIZE)}
          />
        </Box>
      )}
    </Box>
  );
}

AppIconSelector.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(THUMBNAIL_SIZE);

  return (
    <>
      {range(APP_ICONS.length).map((index) => (
        <Fragment key={index}>
          {index > 0 && <SettingsListGroup.Separator />}
          <SettingsListGroup.Radio.Loading
            // 받은 뒤 썸네일과 같은 앱 아이콘 모서리 비율이다
            icon={<Skeleton className="rounded-[10px]" style={{ width: size, height: size }} />}
          />
        </Fragment>
      ))}
    </>
  );
};

AppIconSelector.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('appIcon');

  return (
    <SettingsListGroup.Custom>
      <QueryErrorFallback
        className="py-4"
        illustrationSize="block"
        title={t('errorDialog.title')}
        description={t('errorDialog.description')}
        reset={reset}
      />
    </SettingsListGroup.Custom>
  );
};
