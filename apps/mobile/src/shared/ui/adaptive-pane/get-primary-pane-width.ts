import type { WindowSizeClass } from '@src/shared/utils/window-size-class';
import type { ReservedRegionFrame } from 'react-native-reserved-regions';
import { match, P } from 'ts-pattern';

interface PrimaryPaneWidthInput {
  windowSizeClass: Exclude<WindowSizeClass, 'compact'>;
  foldFrame: ReservedRegionFrame | undefined;
}

/** 접힘선이 있으면 목록을 접힘선 앞면에 맞추고, 없으면 size class별 목록 폭을 쓴다. */
export function getPrimaryPaneWidth({ windowSizeClass, foldFrame }: PrimaryPaneWidthInput): number {
  return match({ windowSizeClass, foldFrame })
    .with({ foldFrame: P.nonNullable }, ({ foldFrame: { x } }) => x)
    .with({ windowSizeClass: 'medium' }, () => 320)
    .with({ windowSizeClass: 'expanded' }, () => 400)
    .exhaustive();
}
