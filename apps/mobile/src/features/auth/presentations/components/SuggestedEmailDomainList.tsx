import { ANIMATION } from '@src/shared/constants/animation.constants';
import { HStack, type Input } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { getEmailDomainSuggestions } from '../utils/get-email-domain-suggestions';

type SuggestedEmailDomainListProps = Pick<ComponentProps<typeof Input>, 'value' | 'onChange'>;

export const SuggestedEmailDomainList = ({
  value = '',
  onChange,
}: SuggestedEmailDomainListProps) => {
  const suggestions = getEmailDomainSuggestions(value);
  if (suggestions.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.duration(ANIMATION.duration.normal).springify()}>
      <HStack gap={8} className="flex-wrap">
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion.domain}
            variant="soft"
            color="default"
            size="md"
            onPress={() => onChange?.(suggestion.value)}
          >
            <Chip.Label>@{suggestion.domain}</Chip.Label>
          </Chip>
        ))}
      </HStack>
    </Animated.View>
  );
};
