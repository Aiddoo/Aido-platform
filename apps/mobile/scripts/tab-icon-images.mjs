const TAB_NAMES = ['todo', 'memo', 'mypage'];
const TAB_ICON_STATES = [
  { sourceSuffix: '', outputSuffix: '' },
  { sourceSuffix: '_selected', outputSuffix: '-selected' },
];
const TAB_ICON_BASE_SIZE = 24;
const TAB_ICON_SCALES = [1, 2, 3];

export const TAB_ICON_IMAGES = TAB_NAMES.flatMap((tabName) =>
  TAB_ICON_STATES.flatMap(({ sourceSuffix, outputSuffix }) =>
    TAB_ICON_SCALES.map((scale) => ({
      sourcePath: `assets/icons/ic_tab_${tabName}${sourceSuffix}.svg`,
      outputPath: `assets/tab-icons/${tabName}${outputSuffix}${scale === 1 ? '' : `@${scale}x`}.png`,
      size: TAB_ICON_BASE_SIZE * scale,
      density: 72 * scale,
    })),
  ),
);
