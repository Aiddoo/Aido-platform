import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const TodosLayout = () => {
  const headerBg = useResolveClassNames('bg-white');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
          fontWeight: '600',
          color: titleColor.color as string,
        },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <View className="justify-center items-center">
            <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen name="[id]" options={{ title: '할 일' }} />
    </Stack>
  );
};

export default TodosLayout;
