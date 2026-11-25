// 시간대를 모르는 사용자의 발송·벽시계 기본값. 한국 우선 서비스라 미상 사용자는 대부분 서울이다
export const SERVICE_DEFAULT_TIMEZONE = "Asia/Seoul";

// 런타임이 아는 이름 가운데 Temporal 판정으로 UTC와 같은 시간대 이름(Node 26 ICU, IANA backward 별칭 포함).
// 기기가 보고한 이 이름들은 보고하지 않은 것으로 읽는다. Hermes에는 Temporal이 없어 앱은 이 목록(대소문자 무시)으로 판정한다
export const UTC_EQUIVALENT_TIMEZONE_NAMES = [
  "Etc/GMT",
  "Etc/GMT+0",
  "Etc/GMT-0",
  "Etc/GMT0",
  "Etc/Greenwich",
  "Etc/UCT",
  "Etc/UTC",
  "Etc/Universal",
  "Etc/Zulu",
  "GMT",
  "GMT+0",
  "GMT-0",
  "GMT0",
  "Greenwich",
  "UCT",
  "UTC",
  "Universal",
  "Zulu",
] as const;
