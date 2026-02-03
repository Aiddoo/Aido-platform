/**
 * Jest Global Teardown - E2E 테스트 전역 정리
 *
 * @description
 * 모든 E2E 테스트가 완료된 후 실행됩니다.
 * Testcontainers 컨테이너를 중지하고 임시 파일을 삭제합니다.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// 임시 파일 경로
const ENV_FILE_PATH = path.join(__dirname, ".e2e-env.json");
const CONTAINER_INFO_PATH = path.join(__dirname, ".e2e-container.json");

export default async function globalTeardown(): Promise<void> {
	console.log("\n🧹 E2E Test Global Teardown\n");

	// 컨테이너 정보 읽기 및 중지
	if (fs.existsSync(CONTAINER_INFO_PATH)) {
		try {
			const containerInfo = JSON.parse(
				fs.readFileSync(CONTAINER_INFO_PATH, "utf-8"),
			);
			console.log(`🛑 Stopping container: ${containerInfo.id}`);

			// docker stop 명령어로 컨테이너 중지
			const { execSync } = await import("node:child_process");
			execSync(`docker stop ${containerInfo.id}`, { stdio: "pipe" });
			console.log("✅ Container stopped");
		} catch (error) {
			console.warn("⚠️  Failed to stop container:", error);
		}

		// 컨테이너 정보 파일 삭제
		fs.unlinkSync(CONTAINER_INFO_PATH);
	}

	// 환경변수 파일 삭제
	if (fs.existsSync(ENV_FILE_PATH)) {
		fs.unlinkSync(ENV_FILE_PATH);
	}

	console.log("✅ E2E Test cleanup complete\n");
}
