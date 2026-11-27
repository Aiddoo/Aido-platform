// 이름을 정하지 않은 친구는 태그로 부른다
export function formatNudgeUserName(name: string | null, userTag: string): string {
  return name ?? userTag;
}
