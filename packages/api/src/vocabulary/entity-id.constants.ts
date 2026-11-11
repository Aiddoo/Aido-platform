/**
 * 서버가 발급한 엔티티 ID의 모양. `c` 뒤에 소문자·숫자가 온다.
 * 지금 발급은 c + 24 hex이고, 옛 행은 CUID v1(25자)이며 29자인 옛 사용자 ID도 있어 길이를 넉넉히 받는다.
 */
export const ENTITY_ID_PATTERN = /^c[0-9a-z]{8,63}$/;
