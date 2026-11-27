export function formatUserHashtag(userTag: string): string {
  return userTag.startsWith('#') ? userTag : `#${userTag}`;
}
