interface WidgetSizeClass {
  isSmall: boolean;
  isLarge: boolean;
}

/** 크기 종류별 디자인 크기(dp). 런처가 크기를 주지 않으면 이 크기로 그리고, 배율도 이 크기로 잰다 */
export function getAndroidWidgetDesignSize({ isSmall, isLarge }: WidgetSizeClass) {
  return { width: isSmall ? 160 : 340, height: isLarge ? 380 : 160 };
}

/** 런처가 준 칸 크기. 일부 런처가 0·NaN을 주면 디자인 크기로 그린다 */
export function getAndroidWidgetSlotSize(
  slot: { width: number; height: number },
  sizeClass: WidgetSizeClass,
) {
  const designSize = getAndroidWidgetDesignSize(sizeClass);
  const resolve = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 ? value : fallback;

  return {
    width: resolve(slot.width, designSize.width),
    height: resolve(slot.height, designSize.height),
  };
}
