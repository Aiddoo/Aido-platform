import { View, type ViewProps } from 'react-native';

/**
 * Metro에서는 react-native-svg-transformer가 .svg를 컴포넌트로 바꿔 주지만 jest는 그
 * 변환을 거치지 않아 에셋 객체가 들어온다. createStyledIcon이 그 객체를 감싸는 순간
 * 컴포넌트가 아니게 되어 아이콘을 품은 화면은 통째로 렌더가 깨진다.
 *
 * 테스트에 그림은 필요 없고 자리만 있으면 되므로 빈 View로 대신한다.
 */
export default function SvgMock(props: ViewProps) {
  return <View {...props} />;
}
