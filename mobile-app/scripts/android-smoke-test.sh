#!/usr/bin/env bash
# Emulator smoke test for a release APK. Run from mobile-app/ with the APK path as $1, on a
# booted emulator with root adb (google_apis image). Used by .github/workflows/android-release.yml.
#
# Checks: the app launches and stays up; the Files tab renders thumbnails through the
# :pdfrender helper process for valid, truncated and garbage PDFs; killing the helper with
# SIGSEGV (what a pdfium crash does) leaves the app running (ADR 0011); no fatal errors from
# the app process in logcat.
set -euo pipefail

APK="$1"
PKG=com.hindipdfeditor.app
OUT="${SMOKE_OUT:-smoke-artifacts}"
mkdir -p "$OUT"
fail() {
  echo "SMOKE FAIL: $*"
  adb logcat -d > "$OUT/logcat.txt" || true
  exit 1
}
shot() { adb exec-out screencap -p > "$OUT/$1.png" || true; }

adb root >/dev/null 2>&1 || true
adb wait-for-device
adb install -r "$APK"

# Test PDFs in Downloads: two real ones, one cut off mid-file, one that is not a PDF at all.
tmp="$(mktemp -d)"
cp fixtures/devanagari-fixture.pdf fixtures/multipage-fixture.pdf "$tmp/"
head -c 1500 fixtures/multipage-fixture.pdf > "$tmp/truncated.pdf"
printf '%%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 9 0 R >> endobj\ntrailer << /Root 1 0 R >>\n%%%%EOF\n' > "$tmp/garbage.pdf"
for f in "$tmp"/*.pdf; do adb push "$f" /sdcard/Download/ >/dev/null; done
adb shell appops set "$PKG" MANAGE_EXTERNAL_STORAGE allow || true
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0

adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
sleep 25
shot 01-home
adb shell pidof "$PKG" >/dev/null || fail "app process died after launch"

# Swipe from Home to the Files tab; its list renders a thumbnail per PDF.
size="$(adb shell wm size | awk '{print $3}' | tail -1)"
w="${size%x*}"
h="${size#*x}"
adb shell input swipe $((w * 9 / 10)) $((h / 2)) $((w / 10)) $((h / 2)) 300
sleep 20
shot 02-files
adb shell pidof "$PKG" >/dev/null || fail "app process died on the Files tab"

app_pid="$(adb shell pidof "$PKG" | tr -d '\r')"
helper_pid="$(adb shell pidof "$PKG:pdfrender" | tr -d '\r' || true)"
echo "app pid: $app_pid, helper pid: ${helper_pid:-none}"
[ -n "$helper_pid" ] || fail "the :pdfrender helper process never started (no thumbnails rendered?)"

adb logcat -d > "$OUT/logcat-before-kill.txt"
adb logcat -d --pid="$app_pid" > "$OUT/logcat-app-before-kill.txt"
adb logcat -d --pid="$helper_pid" > "$OUT/logcat-helper-before-kill.txt"
if grep -q -E "FATAL EXCEPTION|Fatal signal" \
  "$OUT/logcat-app-before-kill.txt" "$OUT/logcat-helper-before-kill.txt"; then
  grep -n -A20 -E "FATAL EXCEPTION|Fatal signal" \
    "$OUT/logcat-app-before-kill.txt" "$OUT/logcat-helper-before-kill.txt" | head -60 || true
  fail "fatal error in logcat before the helper was killed"
fi
grep -E "pdfpageimage|PdfRender|pdf-page-image|Failed to render|damaged or unsupported" \
  "$OUT/logcat-before-kill.txt" | head -20 || true

# Simulate a pdfium crash: SIGSEGV the helper. The app must stay up.
adb shell kill -11 "$helper_pid"
sleep 5
adb shell pidof "$PKG" >/dev/null || fail "app died when the helper process crashed"
[ "$(adb shell pidof "$PKG" | tr -d '\r')" = "$app_pid" ] || fail "app process restarted"

# Swipe back to Home and to Files again, then pull to refresh (a device rescan).
adb shell input swipe $((w / 10)) $((h / 2)) $((w * 9 / 10)) $((h / 2)) 300
sleep 3
adb shell input swipe $((w * 9 / 10)) $((h / 2)) $((w / 10)) $((h / 2)) 300
sleep 3
adb shell input swipe $((w / 2)) $((h / 3)) $((w / 2)) $((h * 2 / 3)) 400
sleep 15
shot 03-files-after-helper-crash
adb shell pidof "$PKG" >/dev/null || fail "app died after the helper crash and a rescan"

adb logcat -d > "$OUT/logcat.txt"
adb logcat -d --pid="$app_pid" > "$OUT/logcat-app.txt"
if grep -q -E "FATAL EXCEPTION|Fatal signal" "$OUT/logcat-app.txt"; then
  grep -n -A20 -E "FATAL EXCEPTION|Fatal signal" "$OUT/logcat-app.txt" | head -60 || true
  fail "Java crash in logcat"
fi
echo "SMOKE PASS: app survived launch, the Files tab, and a SIGSEGV of the PDF helper process"
