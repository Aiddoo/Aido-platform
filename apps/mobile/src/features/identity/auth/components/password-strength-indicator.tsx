import {
  hasDisallowedPasswordCharacter,
  PASSWORD_ALLOWED_SYMBOLS,
  PASSWORD_RULES,
} from '@aido/api/vocabulary';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { CheckmarkIcon, HStack, InfoIcon, Text, VStack } from '@src/shared/ui';

import { hasLetter, hasMinLength, hasNumber } from '../domains/password.model';

export interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation('auth');

  return (
    <VStack gap={8}>
      <HStack gap={16} className="items-center">
        <RuleItem isSatisfied={hasLetter(password)} label={t('passwordRules.hasLetter')} />
        <RuleItem isSatisfied={hasNumber(password)} label={t('passwordRules.hasNumber')} />
        <RuleItem
          isSatisfied={hasMinLength(password)}
          label={t('passwordRules.minLength', { count: PASSWORD_RULES.MIN_LENGTH })}
        />
      </HStack>
      {/* 세 규칙이 모두 초록이어도 다음 버튼이 꺼져 있는 유일한 경우라 이유를 따로 보인다 */}
      {hasDisallowedPasswordCharacter(password) && <DisallowedCharacterNotice />}
    </VStack>
  );
}

function RuleItem({ isSatisfied, label }: { isSatisfied: boolean; label: string }) {
  const fontScaledSize = useFontScaledSize();
  const color = isSatisfied ? 'text-success' : 'text-gray-5';

  return (
    <HStack gap={4} className="items-center">
      <CheckmarkIcon
        colorClassName={color}
        width={fontScaledSize(14)}
        height={fontScaledSize(14)}
      />
      <Text className={color} size="b4">
        {label}
      </Text>
    </HStack>
  );
}

function DisallowedCharacterNotice() {
  const { t } = useTranslation('auth');
  const fontScaledSize = useFontScaledSize();

  return (
    <HStack gap={4} align="center" accessibilityRole="alert" accessibilityLiveRegion="polite">
      <InfoIcon
        colorClassName="text-error"
        width={fontScaledSize(14)}
        height={fontScaledSize(14)}
      />
      <Text size="b4" tone="danger" lineBreakStrategyIOS="hangul-word" className="flex-1">
        {t('passwordRules.disallowedCharacter', { symbols: PASSWORD_ALLOWED_SYMBOLS })}
      </Text>
    </HStack>
  );
}
