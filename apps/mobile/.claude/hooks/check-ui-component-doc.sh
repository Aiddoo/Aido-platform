#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# src/shared/ui/ 하위 .tsx 파일인지 확인
if [[ "$FILE_PATH" == *"src/shared/ui/"*".tsx" ]]; then
  # 컴포넌트 디렉토리와 이름 추출
  COMPONENT_DIR=$(echo "$FILE_PATH" | sed -n 's|.*src/shared/ui/\([^/]*\)/.*|\1|p')
  DOC_PATH="apps/mobile/src/shared/ui/${COMPONENT_DIR}/${COMPONENT_DIR}.md"

  # .md 파일 존재 여부 확인
  if [ ! -f "$DOC_PATH" ]; then
    echo "[UI Component Doc] 새 컴포넌트 감지: ${COMPONENT_DIR}"
    echo "→ 컴포넌트 문서(${DOC_PATH})를 생성하고 apps/mobile/.claude/ui-components.md 테이블에 추가하세요."
    echo "→ CLAUDE.md의 'UI 컴포넌트 문서 규칙' 섹션을 참고하세요."
  fi
fi

exit 0
