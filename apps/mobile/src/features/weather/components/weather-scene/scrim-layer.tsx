import { LinearGradient, Rect, vec } from '@shopify/react-native-skia';

/** 시안 배경은 그대로 두되, 상태 표시줄과 맨 아래 글자가 밝은 하늘에서도 읽히도록 가장자리만 살짝 어둡게 한다. */
const SCRIM_COLORS = {
  day: ['rgba(0,10,30,0.2)', 'rgba(0,10,30,0)', 'rgba(0,10,30,0)', 'rgba(0,10,30,0.16)'],
  night: ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.12)'],
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
        positions={[0, 0.22, 0.75, 1]}
      />
    </Rect>
  );
}
