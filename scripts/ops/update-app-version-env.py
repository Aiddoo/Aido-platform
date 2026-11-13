#!/usr/bin/env python3
"""Update only the three app-version keys; never print other environment values."""

import argparse
import os
from pathlib import Path
import re
import stat
import tempfile


KEYS = (
    b"APP_VERSION_CHECK_ENABLED",
    b"APP_VERSION_CHECK_IOS_LATEST_VERSION",
    b"APP_VERSION_CHECK_ANDROID_LATEST_VERSION",
)
ASSIGNMENT = re.compile(rb"^[ \t]*(?:export[ \t]+)?(" + b"|".join(KEYS) + rb")[ \t]*=")
VERSION = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\Z")


def update(content, values):
    lines = content.splitlines(keepends=True)
    newline = b"\r\n" if b"\r\n" in content else b"\n"
    seen = set()
    result = []
    for line in lines:
        match = ASSIGNMENT.match(line)
        if not match:
            result.append(line)
            continue
        key = match.group(1)
        if key in seen:
            raise ValueError("duplicate app-version key: " + key.decode())
        seen.add(key)
        ending = b"\r\n" if line.endswith(b"\r\n") else b"\n" if line.endswith(b"\n") else b""
        result.append(key + b"=" + values[key] + ending)
    missing = [key for key in KEYS if key not in seen]
    if missing and result and not result[-1].endswith(b"\n"):
        result[-1] += newline
    result.extend(key + b"=" + values[key] + newline for key in missing)
    updated = b"".join(result)
    # This comparison deliberately excludes only the three allowed assignments.
    unrelated = lambda data: b"".join(
        line for line in data.splitlines(keepends=True) if not ASSIGNMENT.match(line)
    ).rstrip(b"\r\n")
    if unrelated(content) != unrelated(updated):
        raise ValueError("unrelated environment content changed")
    return updated


def atomic_write(path, content, mode):
    fd, name = tempfile.mkstemp(prefix=".app-version-", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.chmod(mode)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ios", required=True)
    parser.add_argument("--android", required=True)
    parser.add_argument("--enabled", choices=("true", "false"), default="false")
    parser.add_argument("--published", action="store_true", help="Confirm both versions are public")
    parser.add_argument("--create", action="store_true", help="Allow a missing env file")
    parser.add_argument("--backup-dir", required=True, type=Path)
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()
    if not all(VERSION.fullmatch(version) for version in (args.ios, args.android)):
        parser.error("versions must be stable MAJOR.MINOR.PATCH values")
    if args.enabled == "true" and not args.published:
        parser.error("enabling requires --published after both store releases are public")
    if len({str(path.absolute()) for path in args.files}) != len(args.files):
        parser.error("duplicate file paths")
    values = dict(zip(KEYS, (args.enabled.encode(), args.ios.encode(), args.android.encode())))
    os.umask(0o077)
    plans = []
    for path in args.files:
        if path.is_symlink() or (path.exists() and not path.is_file()):
            raise ValueError("env path must be a regular file")
        if not path.exists() and not args.create:
            raise ValueError("missing env file; use --create deliberately")
        exists = path.exists()
        original = path.read_bytes() if exists else b""
        mode = stat.S_IMODE(path.stat().st_mode) if exists else 0o600
        changed = update(original, values)
        if changed != original:
            plans.append((path, original, changed, mode, exists))
    if not plans:
        print("No changes; all app-version keys already match.")
        return
    args.backup_dir.mkdir(parents=True, exist_ok=False, mode=0o700)
    # Back up every existing file before touching any input file. Backups are private.
    for index, (path, original, _, _, exists) in enumerate(plans):
        if exists:
            (args.backup_dir / (str(index) + "-" + path.name)).write_bytes(original)
    for path, _, changed, mode, _ in plans:
        atomic_write(path, changed, mode)
        print("Updated:", path)
    print("Private backups:", args.backup_dir)
    print("App version check:", args.enabled, "iOS:", args.ios, "Android:", args.android)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        # Avoid tracebacks or exception payloads that might contain env file content.
        print("Update failed:", type(error).__name__)
        raise SystemExit(1)
