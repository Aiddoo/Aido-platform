// 답장·감사는 지금도 친구이고 받은 사람이 소유한 공개 할 일일 때만 할 수 있다
export function isNudgeInteractionAvailable(params: {
  readonly receiverId: string;
  readonly isMutualFriend: boolean;
  readonly todoOwnerId: string;
  readonly todoVisibility: string;
}): boolean {
  return (
    params.isMutualFriend &&
    params.todoOwnerId === params.receiverId &&
    params.todoVisibility === "PUBLIC"
  );
}
