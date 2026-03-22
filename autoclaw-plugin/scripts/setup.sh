#!/bin/bash
# Chartcode setup — runs at SessionStart. Must be FAST (<100ms) when binary exists.

PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.chartcode}"

# 1. Find or install chartcode binary
if command -v chartcode &>/dev/null; then
    BIN="chartcode"
elif [ -x "${PLUGIN_DATA}/bin/chartcode" ]; then
    BIN="${PLUGIN_DATA}/bin/chartcode"
else
    # Auto-install: download precompiled binary from GitHub Releases
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64) ARCH="x86_64" ;;
        arm64|aarch64) ARCH="aarch64" ;;
    esac
    case "$OS" in
        darwin) TARGET="${ARCH}-apple-darwin" ;;
        linux) TARGET="${ARCH}-unknown-linux-gnu" ;;
        *) echo "Chartcode: unsupported platform ${OS}/${ARCH}" >&2; exit 0 ;;
    esac

    RELEASE_URL="https://github.com/LeoBernazzoli/graphcode/releases/latest/download/chartcode-${TARGET}"
    mkdir -p "${PLUGIN_DATA}/bin"

    echo "Chartcode: installing binary..." >&2
    if curl -fsSL "$RELEASE_URL" -o "${PLUGIN_DATA}/bin/chartcode" 2>/dev/null; then
        chmod +x "${PLUGIN_DATA}/bin/chartcode"
        BIN="${PLUGIN_DATA}/bin/chartcode"
        echo "Chartcode: installed to ${PLUGIN_DATA}/bin/chartcode" >&2
    else
        echo "Chartcode: could not download binary. Install manually:" >&2
        echo "  npm install -g chartcode" >&2
        echo "  or: cargo install chartcode" >&2
        echo "  or: download from https://github.com/LeoBernazzoli/graphcode/releases" >&2
        exit 0
    fi
fi

# 2. If no KG exists, tell the user to run init
KG_PATH="${AUTOCLAW_KG:-./knowledge.kg}"
if [ ! -f "$KG_PATH" ]; then
    echo "Chartcode: run /chartcode:start to index your project" >&2
    exit 0
fi

# 3. If rules already exist, skip (fast path — no KG load)
if [ -d ".claude/rules" ] && [ "$(ls .claude/rules/ 2>/dev/null | wc -l)" -gt 2 ]; then
    exit 0
fi

# 4. Only sync-rules if rules don't exist yet (slow path — loads KG)
"$BIN" sync-rules 2>/dev/null
echo "Chartcode: rules generated." >&2
