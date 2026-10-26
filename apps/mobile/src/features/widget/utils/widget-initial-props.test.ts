import en from '../../../shared/i18n/locales/en/widget.json';
import { createInitialWidgetProps, createRegisteredWidgetProps } from './widget-initial-props';

describe('createRegisteredWidgetProps', () => {
  it('첫 동기화 전 문구는 영어 키로 넘기고 위젯 번들이 기기 언어로 바꾸게 표시한다', () => {
    // When
    const props = createRegisteredWidgetProps();

    // Then
    expect(props).toMatchObject({
      state: 'loggedOut',
      stateTitle: en.state.loggedOutTitle,
      stateCta: en.state.loggedOutCta,
      localizeStateCopy: true,
    });
  });

  it('앱이 만든 props는 이미 앱 언어 문구라 위젯 번들에서 다시 바꾸지 않는다', () => {
    // When
    const props = createInitialWidgetProps('ko');

    // Then
    expect(props.localizeStateCopy).toBeUndefined();
  });
});
