import { ANIMATION } from '@src/shared/constants/animation.constants';
import { HStack } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import { type FieldValues, type Path, useFormContext, useWatch } from 'react-hook-form';
import Animated, { FadeInUp } from 'react-native-reanimated';

const EMAIL_DOMAINS = [
  'gmail.com',
  'naver.com',
  'daum.net',
  'outlook.com',
  'icloud.com',
  'kakao.com',
] as const;
const MAX_SUGGESTED_DOMAINS = 3;

interface SuggestedEmailDomainListProps<T extends FieldValues> {
  name: Path<T>;
}

export const SuggestedEmailDomainList = <T extends FieldValues>({
  name,
}: SuggestedEmailDomainListProps<T>) => {
  const { setValue, control } = useFormContext<T>();
  const email = useWatch({ control, name });

  const normalizedEmail = (email as string) ?? '';
  const [localPart, domainPart] = splitEmail(normalizedEmail);
  const suggestedDomains = getSuggestedDomains(normalizedEmail, domainPart);

  if (suggestedDomains.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeInUp.duration(ANIMATION.duration.normal).springify()}>
      <HStack gap={8} className="flex-wrap">
        {suggestedDomains.slice(0, MAX_SUGGESTED_DOMAINS).map((domain) => (
          <Chip
            key={domain}
            variant="soft"
            color="default"
            size="md"
            onPress={() =>
              setValue(name, `${localPart}@${domain}` as T[Path<T>], {
                shouldValidate: true,
              })
            }
          >
            <Chip.Label>@{domain}</Chip.Label>
          </Chip>
        ))}
      </HStack>
    </Animated.View>
  );
};

const splitEmail = (value: string): [string, string] => {
  const atIndex = value.lastIndexOf('@');
  if (atIndex === -1) {
    return [value, ''];
  }
  return [value.substring(0, atIndex), value.substring(atIndex + 1)];
};

const getSuggestedDomains = (rawEmail: string, domainPart: string) => {
  if (!rawEmail.includes('@')) {
    return [];
  }

  if (domainPart && EMAIL_DOMAINS.includes(domainPart as (typeof EMAIL_DOMAINS)[number])) {
    return [];
  }

  return EMAIL_DOMAINS.filter((domain) => domain.startsWith(domainPart));
};
