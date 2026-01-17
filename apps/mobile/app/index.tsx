import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, Button, Switch } from 'heroui-native';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Uniwind, useUniwind, withUniwind } from 'uniwind';

const StyledIonicons = withUniwind(Ionicons);

export default function HomeScreen() {
  const { theme } = useUniwind();
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    Uniwind.setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="mb-6 text-base text-main">홈 페이지</Text>

      {/* 테마 토글 */}
      <View className="mb-8 flex-row items-center gap-3">
        <Text className="text-sm text-gray-6">라이트</Text>
        <Switch
          isSelected={isDark}
          onSelectedChange={toggleTheme}
          className="h-[32px] w-[56px]"
          animation={{
            backgroundColor: {
              value: ['#E0E0E0', '#424242'],
            },
          }}
        >
          <Switch.Thumb
            className="size-[22px]"
            animation={{
              left: {
                value: 4,
                springConfig: {
                  damping: 30,
                  stiffness: 300,
                  mass: 1,
                },
              },
            }}
          />
          <Switch.StartContent className="left-2">
            {isDark && (
              <Animated.View key="moon" entering={ZoomIn.springify()}>
                <StyledIonicons name="moon" size={14} className="text-gray-9" />
              </Animated.View>
            )}
          </Switch.StartContent>
          <Switch.EndContent className="right-2">
            {!isDark && (
              <Animated.View key="sun" entering={ZoomIn.springify()}>
                <StyledIonicons name="sunny" size={14} className="text-gray-8" />
              </Animated.View>
            )}
          </Switch.EndContent>
        </Switch>
        <Text className="text-sm text-foreground">다크</Text>
      </View>

      <BottomSheet>
        <BottomSheet.Trigger asChild>
          <Button variant="primary">
            <Button.Label>바텀시트 열기</Button.Label>
          </Button>
        </BottomSheet.Trigger>

        <BottomSheet.Portal>
          <BottomSheet.Overlay className="bg-black/40" />
          <BottomSheet.Content className="rounded-t-3xl bg-surface px-6 pb-10 pt-6">
            <BottomSheet.Title className="text-lg font-semibold text-foreground">
              HeroUI 바텀시트
            </BottomSheet.Title>
            <BottomSheet.Description className="mt-2 text-sm text-muted">
              버튼을 눌러서 열렸어요.
            </BottomSheet.Description>
            <BottomSheet.Close asChild>
              <Button className="mt-6">
                <Button.Label>닫기</Button.Label>
              </Button>
            </BottomSheet.Close>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
