import { LinearGradient, Rect, vec } from '@shopify/react-native-skia';

// 흰 글자는 glass 카드 위에 놓이지만, 카드 밖 헤더·큰 기온도 밝은 낮 하늘에서 읽히도록 위·아래를 어둡게 깐다.
const SCRIM_COLORS = {
  day: ['rgba(0,10,30,0.28)', 'rgba(0,10,30,0.1)', 'rgba(0,10,30,0.32)'],
  night: ['rgba(0,0,0,0.16)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.2)'],
} as const;

type ScrimLayerProps = {
  isDaylight: boolean;
  width: number;
  height: number;
};

export function ScrimLayer({ isDaylight, width, height }: ScrimLayerProps) {
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <LinearGradient
        start={vec(0, 0)}
        end={vec(0, height)}
        colors={[...SCRIM_COLORS[isDaylight ? 'day' : 'night']]}
        positions={[0, 0.45, 1]}
      />
    </Rect>
  );
}
