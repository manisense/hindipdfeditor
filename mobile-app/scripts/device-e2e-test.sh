#!/usr/bin/env bash
# On-device E2E smoke test for Hindi PDF Editor (requires USB debugging + one PDF in Download).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.hindipdfeditor.app"
ACTIVITY="$PKG/.MainActivity"

echo "==> Checking adb device…"
SERIAL="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [ -z "$SERIAL" ]; then
  echo "ERROR: No Android device attached. Enable USB debugging and reconnect."
  exit 1
fi
echo "    Device: $SERIAL"

if [ ! -f "$APK" ]; then
  echo "==> Building debug APK…"
  (cd "$ROOT/android" && ./gradlew assembleDebug)
fi

echo "==> Installing APK…"
adb install -r "$APK"

echo "==> Starting Metro (if not running)…"
if ! curl -sf http://localhost:8081/status >/dev/null 2>&1; then
  (cd "$ROOT" && npx expo start --dev-client) &
  sleep 8
fi

echo "==> Launching app…"
adb shell am force-stop "$PKG" || true
adb shell am start -n "$ACTIVITY"
sleep 5

WM="$(adb shell wm size | awk '{print $3}')"
W="${WM%x*}"
H="${WM#*x}"
echo "    Screen: ${W}x${H}"

# Tap "Open a PDF" on landing (center-bottom of typical phone layout).
OPEN_X=$((W / 2))
OPEN_Y=$((H * 64 / 100))
adb shell input tap "$OPEN_X" "$OPEN_Y"
sleep 4

# Tap first PDF in DocumentsUI grid (top-left tile — adjust if picker layout differs).
adb shell input tap $((W * 14 / 100)) $((H * 32 / 100))
sleep 12

SHOT="/tmp/hpe-e2e-opened.png"
adb exec-out screencap -p > "$SHOT"
echo "    Screenshot after open: $SHOT"

# Tap near center of page (likely body text on leave form).
adb shell input tap $((W * 18 / 100)) $((H * 38 / 100))
sleep 3
adb exec-out screencap -p > /tmp/hpe-e2e-tapped.png
echo "    Screenshot after tap: /tmp/hpe-e2e-tapped.png"

# Scroll to Export and tap.
adb shell input swipe "$((W/2))" "$((H*75/100))" "$((W/2))" "$((H*35/100))" 400
sleep 1
adb shell input tap "$((W/2))" "$((H*96/100))"
sleep 10
adb exec-out screencap -p > /tmp/hpe-e2e-exported.png
echo "    Screenshot after export: /tmp/hpe-e2e-exported.png"

# Parse-back check on latest exported PDF in app cache.
PDF="$(adb shell "run-as $PKG find /data/user/0/$PKG/cache -name '*.pdf' 2>/dev/null" | tail -1 | tr -d '\r')"
if [ -n "$PDF" ]; then
  adb shell "run-as $PKG cat $PDF" > /tmp/hpe-e2e-export.pdf
  node -e "
    const fs = require('fs');
    const { PDFDocument } = require('@cantoo/pdf-lib');
    PDFDocument.load(fs.readFileSync('/tmp/hpe-e2e-export.pdf')).then(d => {
      console.log('    Export parse-back OK:', d.getPageCount(), 'page(s)');
    });
  "
  echo "    Exported PDF: /tmp/hpe-e2e-export.pdf"
else
  echo "WARN: Could not find exported PDF in app cache — check /tmp/hpe-e2e-exported.png"
fi

echo "==> E2E smoke test finished. Review screenshots in /tmp/hpe-e2e-*.png"
