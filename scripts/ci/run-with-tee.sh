#!/usr/bin/env bash
set -uo pipefail

if [[ $# -lt 2 ]]; then
	echo "usage: $0 <log-path> <command> [args...]" >&2
	exit 2
fi

log_path="$1"
shift

"$@" 2>&1 | tee "$log_path"
pipeline_status=("${PIPESTATUS[@]}")

if [[ ${pipeline_status[0]} -ne 0 ]]; then
	exit "${pipeline_status[0]}"
fi

exit "${pipeline_status[1]}"
