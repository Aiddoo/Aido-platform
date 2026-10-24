import type { WindowSizeClass } from '@src/shared/utils/window-size-class';
import { match } from 'ts-pattern';

interface PrimaryPaneWidthInput {
  windowSizeClass: Exclude<WindowSizeClass, 'compact'>;
  isBookPosture: boolean;
  windowWidth: number;
}

export function getPrimaryPaneWidth({
  windowSizeClass,
  isBookPosture,
  windowWidth,
}: PrimaryPaneWidthInput): number {
  return match({ windowSizeClass, isBookPosture })
    .with({ isBookPosture: true }, () => Math.round(windowWidth / 2))
    .with({ windowSizeClass: 'medium' }, () => 320)
    .with({ windowSizeClass: 'expanded' }, () => 400)
    .exhaustive();
}
