import { ErrorCode } from "@aido/api/errors";

import { Invite } from "../../../domain/aggregates/invites/invite.aggregate.js";
import type { InviteWithInviter } from "../../ports/invites/invite.repository.port.js";
import { PreviewInvite } from "./preview-invite.use-case.js";

const INVITER = { userId: "inviter-1", name: "매튜", userTag: "MATT2025", profileImage: null };

function createPreview(found: InviteWithInviter | null, isEnabled = true) {
  const requestedCodes: string[] = [];
  const useCase = new PreviewInvite({
    inviteRepository: {
      findByCodeWithInviter: async (code) => {
        requestedCodes.push(code.value);
        return found;
      },
    },
    inviteConfig: { isEnabled },
  });
  return { useCase, requestedCodes };
}

function invite(status: "ACTIVE" | "REVOKED"): Invite {
  return Invite.reconstitute({
    id: "invite-1",
    inviterId: INVITER.userId,
    code: "K7M2QX",
    status,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    revokedAt: status === "REVOKED" ? new Date("2026-11-02T00:00:00.000Z") : null,
  });
}

describe("PreviewInvite", () => {
  it("붙여 넣은 소문자·하이픈 코드를 정규화해 찾고 초대한 사람 프로필을 반환한다", async () => {
    // Given
    const { useCase, requestedCodes } = createPreview({
      invite: invite("ACTIVE"),
      inviter: INVITER,
    });

    // When
    const inviter = await useCase.execute({ code: "k7m2-qx" });

    // Then
    expect(requestedCodes).toEqual(["K7M2QX"]);
    expect(inviter).toEqual(INVITER);
  });

  it.each([
    { name: "없는 코드", found: null, isEnabled: true, errorCode: ErrorCode.INVITE_2101 },
    {
      name: "폐기된 코드",
      found: { invite: invite("REVOKED"), inviter: INVITER },
      isEnabled: true,
      errorCode: ErrorCode.INVITE_2102,
    },
    {
      name: "기능 꺼짐",
      found: { invite: invite("ACTIVE"), inviter: INVITER },
      isEnabled: false,
      errorCode: ErrorCode.INVITE_2105,
    },
  ])("$name이면 $errorCode를 반환한다", async ({ found, isEnabled, errorCode }) => {
    // Given
    const { useCase } = createPreview(found, isEnabled);

    // When
    const preview = useCase.execute({ code: "K7M2QX" });

    // Then
    await expect(preview).rejects.toMatchObject({ errorCode });
  });
});
