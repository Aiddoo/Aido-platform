import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'heroui-native';
import { ScrollView, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Uniwind, useUniwind, withUniwind } from 'uniwind';
import { H1, H2, H3, H4, Text } from './core/component/ui/Text';

const StyledIonicons = withUniwind(Ionicons);

export default function HomeScreen() {
  const { theme } = useUniwind();
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    Uniwind.setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-6 py-8">
        {/* 테마 토글 */}
        <View className="mb-8 flex-row items-center justify-center gap-3">
          <Text size="b3" tone="neutral" shade={6}>
            라이트
          </Text>
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
          <Text size="b3" tone="neutral">
            다크
          </Text>
        </View>

        {/* Heading 컴포넌트 */}
        <View className="mb-8 rounded-2xl bg-surface p-4">
          <Text size="e1" tone="neutral" shade={6} className="mb-4">
            Heading 컴포넌트
          </Text>

          <H1 className="mb-2">H1 - Large Title (30px)</H1>
          <H2 className="mb-2">H2 - Title 1 (28px)</H2>
          <H3 className="mb-2">H3 - Title 2 (22px)</H3>
          <H4 className="mb-3">H4 - Title 3 (20px)</H4>

          <H1 emphasize className="mb-2">
            H1 emphasize
          </H1>
          <H1 headline="STEP 1">H1 with headline</H1>
        </View>

        {/* Text 컴포넌트 직접 사용 */}
        <View className="mb-8 rounded-2xl bg-surface p-4">
          <Text size="e1" tone="neutral" shade={6} className="mb-4">
            Text 컴포넌트 (size prop)
          </Text>

          <Text size="h1" className="mb-1">
            h1 - 30px
          </Text>
          <Text size="t1" className="mb-1">
            t1 - 28px
          </Text>
          <Text size="t2" className="mb-1">
            t2 - 22px
          </Text>
          <Text size="t3" className="mb-1">
            t3 - 20px
          </Text>
          <Text size="b1" className="mb-1">
            b1 - 17px
          </Text>
          <Text size="b2" className="mb-1">
            b2 - 16px
          </Text>
          <Text size="b3" className="mb-1">
            b3 - 15px (기본값)
          </Text>
          <Text size="b4" className="mb-1">
            b4 - 13px
          </Text>
          <Text size="e1" className="mb-1">
            e1 - 12px
          </Text>
          <Text size="e2">e2 - 11px</Text>
        </View>

        {/* Weight 테스트 */}
        <View className="mb-8 rounded-2xl bg-surface p-4">
          <Text size="e1" tone="neutral" shade={6} className="mb-4">
            Font Weight
          </Text>

          <Text size="b1" weight="normal" className="mb-1">
            Normal (400)
          </Text>
          <Text size="b1" weight="medium" className="mb-1">
            Medium (500)
          </Text>
          <Text size="b1" weight="semibold" className="mb-1">
            Semibold (600)
          </Text>
          <Text size="b1" weight="bold">
            Bold (700)
          </Text>
        </View>

        {/* Tone + Shade 테스트 */}
        <View className="mb-8 rounded-2xl bg-surface p-4">
          <Text size="e1" tone="neutral" shade={6} className="mb-4">
            Tone (시맨틱 색상)
          </Text>
          <Text size="b2" tone="neutral" className="mb-1">
            neutral (기본)
          </Text>
          <Text size="b2" tone="brand" className="mb-1">
            brand (메인 컬러)
          </Text>
          <Text size="b2" tone="danger" className="mb-1">
            danger (에러)
          </Text>
          <Text size="b2" tone="warning" className="mb-1">
            warning (경고)
          </Text>
          <Text size="b2" tone="success" className="mb-1">
            success (성공)
          </Text>
          <Text size="b2" tone="info">
            info (정보)
          </Text>
        </View>

        {/* Shade 테스트 (neutral only) */}
        <View className="rounded-2xl bg-surface p-4">
          <Text size="e1" tone="neutral" shade={6} className="mb-4">
            Shade (neutral 전용)
          </Text>
          <Text size="b2" tone="neutral" shade={10} className="mb-1">
            shade 10 (가장 진함)
          </Text>
          <Text size="b2" tone="neutral" shade={8} className="mb-1">
            shade 8
          </Text>
          <Text size="b2" tone="neutral" shade={6} className="mb-1">
            shade 6
          </Text>
          <Text size="b2" tone="neutral" shade={4} className="mb-1">
            shade 4
          </Text>
          <Text size="b2" tone="neutral" shade={2}>
            shade 2 (가장 연함)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
