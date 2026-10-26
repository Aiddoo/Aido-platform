// 틀 없는 화면 카드(Play) 배치. OS 막대를 잘라 낸 캡처를 둥근 카드에 담을 때
// 위·아래에 화면 배경색 여백을 둬서 모서리 곡선(radius)이 앱 요소를 자르지 않게 하고,
// 높이가 모자라거나(키보드처럼) 내용이 이어지는 화면은 아래를 페이드로 끝낸다.
// 템플릿(브라우저)에서도 쓰므로 바깥 변수를 참조하지 않는 순수 함수로 둔다.

export function cardLayout({
  srcWidth,
  srcHeight,
  cropTop,
  cropBottom,
  cardWidth,
  maxHeight = null,
  radiusRatio,
  continues = false,
}) {
  // 모서리 곡선과 내용 사이 여백: radius보다 조금 크게
  const pad = 1.15;
  const scale = cardWidth / srcWidth;
  const radius = cardWidth * radiusRatio;
  const padTop = radius * pad;
  const padBottom = radius * pad;
  const natural = srcHeight - cropTop - cropBottom;
  const room = maxHeight == null ? natural : (maxHeight - padTop - padBottom) / scale;
  const visible = Math.max(0, Math.min(natural, room));
  const truncated = continues || visible < natural;
  const contentHeight = visible * scale;
  const fade = truncated ? Math.min(cardWidth * 0.11, contentHeight * 0.25) : 0;
  return {
    scale,
    radius,
    padTop,
    padBottom,
    visible,
    truncated,
    fade,
    contentTop: padTop,
    contentBottom: padTop + contentHeight,
    height: padTop + contentHeight + padBottom,
    imageTop: padTop - cropTop * scale,
    imageHeight: srcHeight * scale,
  };
}

// 높이를 정해 두고(태블릿 두 장 배치) 그 높이에 맞는 카드 너비
export function cardWidthForHeight({
  srcWidth,
  srcHeight,
  cropTop,
  cropBottom,
  height,
  radiusRatio,
}) {
  const pad = 1.15;
  const natural = srcHeight - cropTop - cropBottom;
  return height / (2 * pad * radiusRatio + natural / srcWidth);
}
