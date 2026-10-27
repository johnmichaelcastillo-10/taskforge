#!/bin/sh
# Builds the Linux .deb inside a throwaway Debian container, so the host needs only Docker:
#
#   docker run --rm -v "$PWD:/desktop" -w /desktop -e TASKFORGE_URL node:24-slim sh scripts/build-linux.sh
#
# (PowerShell: -v "${PWD}:/desktop".) Any Debian-based image works (node:24-slim, rust:1-bookworm):
# whatever is missing, Node or Rust, is installed in the container. The package lands in
# src-tauri/target/release/bundle/deb/. CI builds the full set (also .AppImage, and the
# Windows installers): .github/workflows/desktop.yml.
set -eu

echo "== System libraries for Tauri (WebKitGTK, tray, SVG icons, keyboard shortcuts)"
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  build-essential ca-certificates curl file pkg-config \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev > /dev/null
command -v npm > /dev/null || apt-get install -y -qq --no-install-recommends nodejs npm > /dev/null

if ! command -v cargo > /dev/null; then
  echo "== Rust (rustup, minimal profile)"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --no-modify-path > /dev/null
  PATH="$HOME/.cargo/bin:$PATH"
  export PATH
fi
cargo --version

echo "== Tauri CLI"
npm ci --no-audit --no-fund

echo "== Build"
# The .deb only: an AppImage needs linuxdeploy, which the CLI downloads from GitHub at build time.
npm run configure
npx tauri build --config src-tauri/tauri.site.conf.json --bundles deb

ls -la src-tauri/target/release/bundle/deb/
