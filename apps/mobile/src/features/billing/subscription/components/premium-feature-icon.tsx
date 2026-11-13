import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import {
  AiFilledIcon,
  AppSquareIcon,
  BellFilledIcon,
  Box,
  CalendarIcon,
  DocsIcon,
  HeartFilledIcon,
  ListFilledIcon,
  MicIcon,
  PawIcon,
  PersonFilledIcon,
  type StyledIcon,
} from '@src/shared/ui';
import { tv } from '@src/shared/utils/tv';

import { type EntitlementFeature } from '../domains/entitlement.model';

const FEATURE_ICONS = {
  AI_PARSE: AiFilledIcon,
  VOICE_NOTE: MicIcon,
  CHEER: HeartFilledIcon,
  NUDGE: PawIcon,
  FRIEND: PersonFilledIcon,
  TODO_CATEGORY: ListFilledIcon,
  AI_REPORT: DocsIcon,
  AI_SUGGESTION: CalendarIcon,
  CUSTOM_REMINDER_TIME: BellFilledIcon,
  APP_ICON: AppSquareIcon,
} as const satisfies Record<EntitlementFeature, StyledIcon>;

const ICON_SIZES = { medium: 20, large: 28 } as const;

const premiumFeatureIcon = tv({
  base: 'items-center justify-center bg-main/10',
  variants: {
    size: {
      medium: 'size-10 rounded-xl',
      large: 'size-14 rounded-2xl',
    },
  },
});

interface PremiumFeatureIconProps {
  feature: EntitlementFeature;
  size: keyof typeof ICON_SIZES;
}

/** 프리미엄 안내 시트와 페이월이 같은 기능을 같은 그림으로 보여 준다 */
export function PremiumFeatureIcon({ feature, size }: PremiumFeatureIconProps) {
  const fontScaledSize = useFontScaledSize();
  const Icon = FEATURE_ICONS[feature];
  const iconSize = fontScaledSize(ICON_SIZES[size]);

  return (
    <Box className={premiumFeatureIcon({ size })}>
      <Icon width={iconSize} height={iconSize} colorClassName="text-main" />
    </Box>
  );
}
