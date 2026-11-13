import { useTrack } from '@src/shared/analytics';
import { useScreenName } from '@src/shared/hooks/use-screen-name';
import { Tabs } from 'heroui-native';
import type { ComponentProps } from 'react';
import type { z } from 'zod';

type ViewTabsProps<TSchema extends z.ZodType<string>> = Omit<
  ComponentProps<typeof Tabs>,
  'value' | 'onValueChange'
> & {
  schema: z.ZodCatch<TSchema>;
  value: z.output<TSchema>;
  onValueChange: (view: z.output<TSchema>) => void;
};

/** `.catch`를 지나면 잘못된 값이 기본값으로 바뀌어 탭이 튀므로, 벗긴 스키마로 검증해 아는 값만 넘긴다 */
export function ViewTabs<TSchema extends z.ZodType<string>>({
  schema,
  value,
  onValueChange,
  ...props
}: ViewTabsProps<TSchema>) {
  const { trackEvent } = useTrack();
  const screenName = useScreenName();

  return (
    <Tabs
      {...props}
      value={value}
      onValueChange={(next) => {
        const parsed = schema.unwrap().safeParse(next);
        if (!parsed.success) {
          return;
        }
        // heroui Tabs는 고른 탭을 다시 눌러도 알린다
        if (parsed.data !== value) {
          trackEvent('view_tab_changed', { screen_name: screenName, view: parsed.data });
        }
        onValueChange(parsed.data);
      }}
    />
  );
}
