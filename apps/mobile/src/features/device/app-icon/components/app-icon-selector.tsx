import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
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

import { APP_ICONS } from '../constants/app-icon.constants';
import { AppIconPolicy } from '../domains/app-icon.model';
import { useChangeAppIconMutationOptions } from '../queries/app-icon.mutations';
import { useGetCurrentAppIconQueryOptions } from '../queries/app-icon.queries';

const THUMBNAIL_SIZE = 40;
const LOCK_BADGE_ICON_SIZE = 10;

/** 홈 화면 아이콘 고르기. 무료 사용자가 기본 밖의 아이콘을 고르면 바꾸기 전에 프리미엄 안내를 띄운다 */
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

  const handleValueChange = async (value: string) => {
    const icon = APP_ICONS.find(({ key }) => key === value);
    if (icon == null || isChanging || icon.key === currentIcon) {
      return;
    }

    if (AppIconPolicy.isPremiumIcon(icon.key) && gate.promptIfBlocked()) {
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
    changeIcon(icon.key);
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
