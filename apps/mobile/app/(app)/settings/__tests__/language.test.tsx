import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createMockAnalytics,
  createMockDIContainer,
  createMockSyncStorage,
} from '@src/shared/__tests__';
import { i18n } from '@src/shared/i18n';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LanguageSettingsScreen from '../language';

// vendor UI(heroui-native)와 그 배럴만 mock — 나머지 의존성은 DI(prop/컨테이너)로 주입한다
jest.mock('@src/shared/ui', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  // biome-ignore lint/suspicious/noExplicitAny: jest.mock 팩토리는 out-of-scope 타입 참조가 금지됨
  const StyledSafeAreaView = (props: any) => React.createElement(View, null, props.children);

  // biome-ignore lint/suspicious/noExplicitAny: jest.mock 팩토리는 out-of-scope 타입 참조가 금지됨
  const ListRow = (props: any) => React.createElement(View, null, props.contents, props.right);
  // biome-ignore lint/suspicious/noExplicitAny: jest.mock 팩토리는 out-of-scope 타입 참조가 금지됨
  ListRow.Texts = (props: any) =>
    React.createElement(
      View,
      null,
      React.createElement(Text, null, props.top),
      props.bottom ? React.createElement(Text, null, props.bottom) : null,
    );

  const NoopIcon = () => null;

  return {
    StyledSafeAreaView,
    ListRow,
    DeviceIcon: NoopIcon,
    KoreanIcon: NoopIcon,
    EnglishIcon: NoopIcon,
  };
});

jest.mock('heroui-native', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');

  const RadioGroupContext = React.createContext(() => {});

  // biome-ignore lint/suspicious/noExplicitAny: jest.mock 팩토리는 out-of-scope 타입 참조가 금지됨
  const RadioGroup = (props: any) =>
    React.createElement(
      RadioGroupContext.Provider,
      { value: props.onValueChange },
      React.createElement(View, null, props.children),
    );

  // biome-ignore lint/suspicious/noExplicitAny: jest.mock 팩토리는 out-of-scope 타입 참조가 금지됨
  RadioGroup.Item = (props: any) => {
    const onValueChange = React.useContext(RadioGroupContext);
    const rendered =
      typeof props.children === 'function' ? props.children({ isSelected: false }) : props.children;
    return React.createElement(
      Pressable,
      { testID: `radio-${props.value}`, onPress: () => onValueChange(props.value) },
      rendered,
    );
  };

  // biome-ignore lint/suspicious/noExplicitAny: jest.mock 팩토리는 out-of-scope 타입 참조가 금지됨
  const Radio = (props: any) => React.createElement(View, null, props.children);
  // biome-ignore lint/suspicious/noExplicitAny: jest.mock 팩토리는 out-of-scope 타입 참조가 금지됨
  Radio.Indicator = (props: any) => React.createElement(View, null, props.children);

  return { Radio, RadioGroup };
});

// reanimated는 네이티브(worklets) 모듈을 import 시 로드해 jest에서 실패한다 — JS 목으로 대체
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: (factory: () => Record<string, unknown>) => factory(),
    withTiming: (value: number) => value,
    Easing: { out: (fn: unknown) => fn, ease: () => 0 },
  };
});

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

const renderScreen = ({
  storage = createMockSyncStorage(),
  analytics = createMockAnalytics(),
} = {}) => {
  render(
    <StaticDIProvider container={createMockDIContainer({ analytics })}>
      <LanguageProvider syncStorage={storage} deviceLanguage={() => 'ko'}>
        <LanguageSettingsScreen />
      </LanguageProvider>
    </StaticDIProvider>,
  );
  return { storage, analytics };
};

describe('LanguageSettingsScreen', () => {
  it('시스템 설정·한국어·English 세 옵션을 렌더링한다', () => {
    // Given / When
    renderScreen();

    // Then
    expect(screen.getByText('시스템 설정')).toBeTruthy();
    expect(screen.getByText('한국어')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('English 선택 시 스토리지 저장·i18n 언어 변경·analytics 이벤트가 발생한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);
    const { analytics } = renderScreen({ storage });

    // When
    fireEvent.press(screen.getByTestId('radio-en'));

    // Then
    expect(storage.set).toHaveBeenCalledWith('aido_language', 'en');
    expect(i18n.language).toBe('en');
    expect(analytics.trackEvent).toHaveBeenCalledWith('settings_changed', {
      setting: 'language',
      value: 'en',
    });
  });

  it('시스템 설정 선택 시 기기 언어 기준으로 i18n 언어가 해석된다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('en');
    renderScreen({ storage });

    // When
    fireEvent.press(screen.getByTestId('radio-system'));

    // Then
    expect(storage.set).toHaveBeenCalledWith('aido_language', 'system');
    expect(i18n.language).toBe('ko');
  });

  it('en으로 저장된 상태에서 화면 라벨이 영어로 렌더링된다', async () => {
    // Given
    await i18n.changeLanguage('en');
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('en');

    // When
    renderScreen({ storage });

    // Then
    expect(screen.getByText('System default')).toBeTruthy();
    expect(screen.getByText('한국어')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });
});
