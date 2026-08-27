interface CommentComposerSubmissionGate {
  current: boolean;
}

interface MountedCommentComposerSession {
  current: boolean;
}

interface RunCommentComposerSubmissionOptions {
  gate: CommentComposerSubmissionGate;
  operation: () => Promise<void> | void;
}

export async function runCommentComposerSubmissionOnce({
  gate,
  operation,
}: RunCommentComposerSubmissionOptions): Promise<void> {
  if (gate.current) {
    return;
  }

  gate.current = true;

  try {
    await operation();
  } finally {
    gate.current = false;
  }
}

export function closeMountedCommentComposerSession({
  session,
  onClose,
}: {
  session: MountedCommentComposerSession;
  onClose: () => void;
}): void {
  if (session.current) {
    onClose();
  }
}
