import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'heroui-native';
import { ScrollView, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Uniwind, useUniwind, withUniwind } from 'uniwind';
import { Caption, H1, H2, H3, H4, Label, Paragraph, Text } from './core/component/ui/Text';

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
          <Text size="b3" color="gray-6">
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
          <Text size="b3" color="foreground">
            다크
          </Text>
        </View>

        {/* 시맨틱 컴포넌트 */}
        <View className="mb-8 rounded-2xl bg-surface p-4">
          <Caption className="mb-4">시맨틱 컴포넌트</Caption>

          <H1 className="mb-2">H1 - Large Title (30px)</H1>
          <H2 className="mb-2">H2 - Title 1 (28px)</H2>
          <H3 className="mb-2">H3 - Title 2 (22px)</H3>
          <H4 className="mb-3">H4 - Title 3 (20px)</H4>

          <Paragraph className="mb-2">Paragraph - Body (17px)</Paragraph>
          <Label className="mb-2">Label - Footnote (13px)</Label>
          <Caption>Caption - Caption 1 (12px)</Caption>
        </View>

        {/* Text 컴포넌트 직접 사용 */}
        <View className="mb-8 rounded-2xl bg-surface p-4">
          <Caption className="mb-4">Text 컴포넌트 (size prop)</Caption>

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
            b1 - 17px (기본값)
          </Text>
          <Text size="b2" className="mb-1">
            b2 - 16px
          </Text>
          <Text size="b3" className="mb-1">
            b3 - 15px
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
          <Caption className="mb-4">Font Weight</Caption>

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

        {/* Color 테스트 */}
        <View className="rounded-2xl bg-surface p-4">
          <Caption className="mb-4">Colors</Caption>
          <Text size="b2" color="gray-10" className="mb-1">
            gray-10 (가장 진함)
          </Text>
          <Text size="b2" color="gray-8" className="mb-1">
            gray-8 (기본)
          </Text>
          <Text size="b2" color="gray-6" className="mb-1">
            gray-6 (muted)
          </Text>
          <Text size="b2" color="gray-4" className="mb-1">
            gray-4 (muted)
          </Text>
          <Text size="b2" color="gray-2" className="mb-1">
            gray-2 (muted)
          </Text>
          <Text size="b2" color="main" className="mb-1">
            main (메인 컬러)
          </Text>
          <Text size="b2" color="accent" className="mb-1">
            accent (강조)
          </Text>
          <Text size="b2" color="error">
            error (에러)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
