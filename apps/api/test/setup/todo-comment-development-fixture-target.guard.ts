interface TodoCommentDevelopmentFixtureTarget {
	nodeEnv: string | undefined;
	apiBaseUrl: string | undefined;
	databaseUrl: string | undefined;
}

export interface SafeTodoCommentDevelopmentFixtureTarget {
	apiBaseUrl: string;
	databaseUrl: string;
	databaseHost: string;
	databaseName: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db", "host.docker.internal"]);

function getUrl(rawValue: string | undefined, label: string): URL {
	if (rawValue === undefined || rawValue.length === 0) {
		throw new Error(`[todo-comment-fixture] ${label}이 없어 실행을 멈춥니다.`);
	}

	try {
		return new URL(rawValue);
	} catch {
		throw new Error(`[todo-comment-fixture] ${label}을 해석할 수 없어 실행을 멈춥니다.`);
	}
}

/** 개발 댓글 fixture가 원격 API나 DB에 닿지 않도록 mutation보다 먼저 fail-closed로 검사합니다. */
export function assertTodoCommentDevelopmentFixtureTarget(
	target: TodoCommentDevelopmentFixtureTarget,
): SafeTodoCommentDevelopmentFixtureTarget {
	if (target.nodeEnv !== "development") {
		throw new Error("[todo-comment-fixture] NODE_ENV=development에서만 실행할 수 있습니다.");
	}

	const apiUrl = getUrl(target.apiBaseUrl, "API_BASE_URL");
	if (apiUrl.protocol !== "http:" || !LOCAL_HOSTS.has(apiUrl.hostname.toLowerCase())) {
		throw new Error(
			`[todo-comment-fixture] 로컬 HTTP API만 허용합니다. 현재 host: ${apiUrl.hostname}`,
		);
	}

	const databaseUrl = getUrl(target.databaseUrl, "DATABASE_URL");
	if (
		databaseUrl.protocol !== "postgresql:" ||
		!LOCAL_HOSTS.has(databaseUrl.hostname.toLowerCase())
	) {
		throw new Error(
			`[todo-comment-fixture] 로컬 PostgreSQL만 허용합니다. 현재 host: ${databaseUrl.hostname}`,
		);
	}

	const databaseName = databaseUrl.pathname.replace(/^\//, "");
	if (databaseName.length === 0) {
		throw new Error("[todo-comment-fixture] DATABASE_URL에 database 이름이 필요합니다.");
	}

	return {
		apiBaseUrl: apiUrl.origin,
		databaseUrl: databaseUrl.toString(),
		databaseHost: databaseUrl.hostname,
		databaseName,
	};
}
