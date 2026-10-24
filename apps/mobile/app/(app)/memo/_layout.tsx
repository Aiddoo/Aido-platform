import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ScreenTitleBar } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function MemoLayout() {
  const headerBg = useResolveClassNames('bg-white');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();
  const { t } = useTranslation('memo');

  return (
    <Stack
      screenOptions={{
        header: (props) => <ScreenTitleBar.StackHeader {...props} />,
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        contentStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
          fontWeight: '600',
          color: titleColor.color as string,
        },
        headerTitleAlign: 'center',
        animation: 'fade_from_bottom',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="create" options={{ title: t('titles.create') }} />
      <Stack.Screen name="[id]/index" options={{ title: '' }} />
      <Stack.Screen name="[id]/ai-review" options={{ title: t('titles.aiReview') }} />
    </Stack>
  );
}
