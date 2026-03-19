#!/bin/bash
set -e

# Graphocode setup — runs on first session and checks binary availability
PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/graphocode}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$0")")}"
AUTOCLAW_BIN=""

# 1. Find or install autoclaw binary
if command -v autoclaw &>/dev/null; then
    AUTOCLAW_BIN="autoclaw"
elif [ -x "${PLUGIN_DATA}/bin/autoclaw" ]; then
    AUTOCLAW_BIN="${PLUGIN_DATA}/bin/autoclaw"
else
    # Try to install
    echo "Graphocode: installing autoclaw binary..." >&2

    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    # Map architecture names
    case "$ARCH" in
        x86_64|amd64) ARCH="x86_64" ;;
        arm64|aarch64) ARCH="aarch64" ;;
    esac

    # Map OS names
    case "$OS" in
        darwin) TARGET="${ARCH}-apple-darwin" ;;
        linux) TARGET="${ARCH}-unknown-linux-gnu" ;;
        mingw*|msys*|cygwin*) TARGET="${ARCH}-pc-windows-msvc" ;;
        *) echo "Graphocode: unsupported OS: ${OS}" >&2; exit 0 ;;
    esac

    RELEASE_URL="https://github.com/leobernazzoli/autoclaw/releases/latest/download/autoclaw-${TARGET}"

    mkdir -p "${PLUGIN_DATA}/bin"

    if command -v curl &>/dev/null; then
        curl -sL "$RELEASE_URL" -o "${PLUGIN_DATA}/bin/autoclaw" 2>/dev/null
    elif command -v wget &>/dev/null; then
        wget -q "$RELEASE_URL" -O "${PLUGIN_DATA}/bin/autoclaw" 2>/dev/null
    fi

    if [ -f "${PLUGIN_DATA}/bin/autoclaw" ]; then
        chmod +x "${PLUGIN_DATA}/bin/autoclaw"
        AUTOCLAW_BIN="${PLUGIN_DATA}/bin/autoclaw"
        echo "Graphocode: binary installed to ${PLUGIN_DATA}/bin/autoclaw" >&2
    else
        # Fallback: try cargo install
        if command -v cargo &>/dev/null; then
            echo "Graphocode: building from source with cargo..." >&2
            cargo install autoclaw 2>/dev/null && AUTOCLAW_BIN="autoclaw"
        fi
    fi

    if [ -z "$AUTOCLAW_BIN" ]; then
        echo "Graphocode: could not install autoclaw. Install manually:" >&2
        echo "  cargo install autoclaw" >&2
        echo "  or download from https://github.com/leobernazzoli/autoclaw/releases" >&2
        exit 0
    fi
fi

# 2. Check if KG exists, if not bootstrap
KG_PATH="${AUTOCLAW_KG:-./knowledge.kg}"
if [ ! -f "$KG_PATH" ]; then
    echo "Graphocode: bootstrapping project (first run)..." >&2
    "$AUTOCLAW_BIN" bootstrap 2>/dev/null
    echo "Graphocode: bootstrap complete." >&2
fi

# 3. Sync rules (generates .claude/rules/ from KG)
"$AUTOCLAW_BIN" sync-rules 2>/dev/null

echo "Graphocode: ready." >&2
