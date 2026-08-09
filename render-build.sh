#!/usr/bin/env bash
#
# Render build for the AdonisJS backend (apps/backend).
#
# Referenced by render.yaml as `bash render-build.sh`. Invoked via bash
# rather than executed directly so it does not depend on the exec bit,
# which is easy to lose on a Windows checkout.
#
# See Developer/deployment-render.md for why each step is here.

set -euo pipefail

WORDLIST_TARGET="apps/backend/resources/wordlist.json"
BUILD_DIR="apps/backend/build"

echo "==> 1/5 Placing the moderation wordlist"

# The wordlist is gitignored on purpose, so a clean Render checkout never
# has it. It arrives as a Render secret file instead: those land in the
# service root at build time and under /etc/secrets at runtime. The
# server throws at boot without it (#services/wordlist), and the build
# itself would NOT catch that, so fail loudly here instead.
if [ ! -f "$WORDLIST_TARGET" ]; then
  for candidate in "./wordlist.json" "/etc/secrets/wordlist.json"; do
    if [ -f "$candidate" ]; then
      echo "    copying $candidate"
      cp "$candidate" "$WORDLIST_TARGET"
      break
    fi
  done
fi

if [ ! -f "$WORDLIST_TARGET" ]; then
  echo "ERROR: $WORDLIST_TARGET is missing." >&2
  echo "Add wordlist.json as a Render secret file on this service." >&2
  echo "Shape is documented in apps/backend/resources/wordlist.example.json." >&2
  exit 1
fi

echo "==> 2/5 Installing workspace dependencies"

# --include=dev is load-bearing. NODE_ENV=production is set on this
# service, and npm reads it: a bare `npm ci` would omit devDependencies
# and the build would fail on the missing assembler, tsc and vite.
npm ci --include=dev

echo "==> 3/5 Building the backend"

# Generates database/schema.ts, the entity index and the Tuyau client
# before compiling (apps/backend/CLAUDE.md).
npx turbo build --filter=@KalookiOnline/backend

echo "==> 4/5 Verifying the build output"

if [ ! -f "$BUILD_DIR/bin/server.js" ]; then
  echo "ERROR: $BUILD_DIR/bin/server.js was not produced." >&2
  exit 1
fi

# adonisrc.ts lists the wordlist under metaFiles so the build copies it,
# but a stale or reordered build can silently skip it and the failure
# would not surface until the server boots. Copy it in if it is absent.
if [ ! -f "$BUILD_DIR/resources/wordlist.json" ]; then
  echo "    wordlist missing from build output, copying it in"
  mkdir -p "$BUILD_DIR/resources"
  cp "$WORDLIST_TARGET" "$BUILD_DIR/resources/wordlist.json"
fi

echo "==> 5/5 Build complete"

# No dependency prune here on purpose. build/ has no package-lock.json
# (the lockfile lives at the monorepo root), so `npm ci --omit=dev`
# inside it fails, and `npm install --omit=dev` would resolve unpinned
# versions. The server runs against the hoisted root node_modules
# instead, which is exactly what the lockfile pinned.
