import request from "supertest";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "@/retention/application/ports/retention-config.port";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("신규 사용자 리텐션 V2 E2E", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		const config: RetentionConfigPort = {
			enabled: true,
			treatmentPercent: 100,
		};
		ctx = await createE2eApp({
			customizeBuilder: (builder) =>
				builder.overrideProvider(RETENTION_CONFIG).useValue(config),
		});
	}, 60_000);

	beforeEach(async () => {
		await ctx.reset();
	});

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	it("회원가입 응답 계약은 그대로 두고 신규 User만 TREATMENT에 등록한다", async () => {
		const response = await request(ctx.app.getHttpServer())
			.post("/v1/auth/register")
			.send({
				email: "retention-new@example.com",
				password: "Test1234!",
				passwordConfirm: "Test1234!",
				termsAgreed: true,
				privacyAgreed: true,
				marketingAgreed: false,
			})
			.expect(201);

		expect(Object.keys(response.body.data).sort()).toEqual([
			"email",
			"emailSent",
			"message",
		]);
		const user = await ctx.testDatabase.getPrisma().user.findUniqueOrThrow({
			where: { email: "retention-new@example.com" },
			include: { retentionAssignments: { include: { stages: true } } },
		});
		expect(user.retentionAssignments).toHaveLength(1);
		expect(user.retentionAssignments[0]?.variant).toBe("TREATMENT");
		expect(user.retentionAssignments[0]?.startedAt).toBeNull();
		expect(user.retentionAssignments[0]?.stages).toHaveLength(0);
		expect(
			await ctx.testDatabase.getPrisma().notification.count({
				where: { userId: user.id },
			}),
		).toBe(0);

		const code = ctx.fakeEmailService.getLastCode("retention-new@example.com");
		await request(ctx.app.getHttpServer())
			.post("/v1/auth/verify-email")
			.send({ email: "retention-new@example.com", code })
			.expect(200);
		const activated = await ctx.testDatabase
			.getPrisma()
			.retentionExperimentAssignment.findFirstOrThrow({
				where: { userId: user.id },
				include: { stages: true },
			});
		expect(activated.startedAt).not.toBeNull();
		expect(activated.stages).toHaveLength(4);
	});

	it("기존 User 레코드에는 서버 작업만으로 assignment가 생기지 않는다", async () => {
		const prisma = ctx.testDatabase.getPrisma();
		const existing = await prisma.user.create({
			data: {
				email: "existing-retention@example.com",
				userTag: "EXIST001",
				status: "ACTIVE",
			},
		});

		await request(ctx.app.getHttpServer()).get("/health").expect(200);

		expect(
			await prisma.retentionExperimentAssignment.count({
				where: { userId: existing.id },
			}),
		).toBe(0);
	});
});
