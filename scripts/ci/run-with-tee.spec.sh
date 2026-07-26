#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT

failure_log="$temporary_directory/failure.log"

set +e
"$repository_root/scripts/ci/run-with-tee.sh" "$failure_log" bash -c 'printf "deliberate failure\\n"; exit 17'
status=$?
set -e

if [[ $status -ne 17 ]]; then
	echo "expected failing command exit status 17, received $status" >&2
	exit 1
fi

if ! grep -Fxq "deliberate failure" "$failure_log"; then
	echo "expected failing command output to be retained in $failure_log" >&2
	exit 1
fi

set +e
"$repository_root/scripts/ci/run-with-tee.sh" "$temporary_directory/missing/output.log" bash -c 'printf "successful command\\n"'
status=$?
set -e

if [[ $status -eq 0 ]]; then
	echo "expected an unwritable log path to fail the pipeline" >&2
	exit 1
fi
