/** `path`는 원소 CHECK가 없는 `text[]`이므로 NULL 원소는 영속성 경계에서 거부한다. */
export function decodeTodoCommentPath(path: readonly (string | null)[]): string[] {
  return path.map((ancestorId) => {
    if (ancestorId == null) {
      throw new Error("댓글 경로에 비어 있는 조상 ID가 있습니다.");
    }

    return ancestorId;
  });
}
