/** API의 접두어 없는 userTag를 사용자에게 보여줄 해시태그로 변환한다. */
export function formatUserHashtag(userTag: string): string {
  return userTag.startsWith('#') ? userTag : `#${userTag}`;
}
