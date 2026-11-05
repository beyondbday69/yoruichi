#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "   Building Yoruichi Android APK         "
echo "========================================="

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Resolve Android SDK
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$SDK_ROOT" ]]; then
  for candidate in "/usr/local/lib/android/sdk" "$HOME/Android/Sdk" "/root/Android/Sdk" "/opt/android-sdk"; do
    if [[ -d "$candidate" ]]; then
      SDK_ROOT="$candidate"
      break
    fi
  done
fi

if [[ -z "$SDK_ROOT" || ! -d "$SDK_ROOT" ]]; then
  echo "Error: Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT."
  exit 1
fi
echo "Using Android SDK: $SDK_ROOT"

# Locate android.jar (favor 35, fallback to 34 or highest available)
ANDROID_JAR=""
for api in 35 34 33; do
  if [[ -f "$SDK_ROOT/platforms/android-$api/android.jar" ]]; then
    ANDROID_JAR="$SDK_ROOT/platforms/android-$api/android.jar"
    break
  fi
done

if [[ -z "$ANDROID_JAR" ]]; then
  ANDROID_JAR=$(find "$SDK_ROOT/platforms" -name "android.jar" | sort -V | tail -n 1 || true)
fi

if [[ -z "$ANDROID_JAR" || ! -f "$ANDROID_JAR" ]]; then
  echo "Error: android.jar not found under $SDK_ROOT/platforms."
  exit 1
fi
echo "Using Platform: $ANDROID_JAR"

# Locate build-tools (favor 35.0.0, fallback to 34.0.0, or latest)
BUILD_TOOLS_DIR=""
for ver in 35.0.0 34.0.0; do
  if [[ -d "$SDK_ROOT/build-tools/$ver" ]]; then
    BUILD_TOOLS_DIR="$SDK_ROOT/build-tools/$ver"
    break
  fi
done

if [[ -z "$BUILD_TOOLS_DIR" ]]; then
  BUILD_TOOLS_DIR=$(find "$SDK_ROOT/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1 || true)
fi

if [[ -z "$BUILD_TOOLS_DIR" ]]; then
  echo "Error: No build-tools found under $SDK_ROOT/build-tools."
  exit 1
fi
echo "Using Build-tools: $BUILD_TOOLS_DIR"

AAPT2="$BUILD_TOOLS_DIR/aapt2"
D8="$BUILD_TOOLS_DIR/d8"
ZIPALIGN="$BUILD_TOOLS_DIR/zipalign"
APKSIGNER="$BUILD_TOOLS_DIR/apksigner"

for tool in "$AAPT2" "$D8" "$ZIPALIGN" "$APKSIGNER"; do
  if [[ ! -x "$tool" ]]; then
    echo "Error: Missing required build tool: $tool"
    exit 1
  fi
done

# 2. Generate icons if missing
python3 scripts/generate_yoruichi_icon.py

# 3. Build Web Bundle
echo "Building mobile web assets..."
if command -v bunx >/dev/null 2>&1; then
  bunx vite build --config vite.mobile.config.ts
else
  npx vite build --config vite.mobile.config.ts
fi

# 4. Export Personality
echo "Exporting mobile personality..."
if command -v bun >/dev/null 2>&1; then
  bun run scripts/export-mobile-personality.ts
else
  node --import tsx scripts/export-mobile-personality.ts
fi

# 5. Compile Java Sources
BUILD_DIR="$PROJECT_ROOT/android/app/build/local-$(date +%Y%m%d-%H%M%S)"
CLASSES_DIR="$BUILD_DIR/classes"
DEX_DIR="$BUILD_DIR/dex"
mkdir -p "$CLASSES_DIR" "$DEX_DIR"

echo "Compiling Java sources..."
JAVA_FILES=$(find "$PROJECT_ROOT/android/app/src/main/java" -name "*.java")
javac -encoding UTF-8 -source 8 -target 8 -classpath "$ANDROID_JAR" -d "$CLASSES_DIR" $JAVA_FILES

# 6. Package Classes Jar
echo "Packaging classes into JAR..."
CLASSES_JAR="$BUILD_DIR/classes.jar"
jar --create --file "$CLASSES_JAR" -C "$CLASSES_DIR" .

# 7. Compile DEX with D8
echo "Compiling DEX..."
"$D8" --lib "$ANDROID_JAR" --min-api 26 --output "$DEX_DIR" "$CLASSES_JAR"

# 8. Compile Resources with AAPT2
echo "Compiling Android resources..."
RES_SRC="$PROJECT_ROOT/android/app/src/main/res"
COMPILED_RES="$BUILD_DIR/resources.zip"
"$AAPT2" compile --dir "$RES_SRC" -o "$COMPILED_RES"

# 9. Link Manifest and Assets
echo "Linking APK with AAPT2..."
UNSIGNED_APK="$BUILD_DIR/unsigned.apk"
ASSET_DIR="$PROJECT_ROOT/android/app/src/main/assets"
MANIFEST="$PROJECT_ROOT/android/app/src/main/AndroidManifest.xml"

"$AAPT2" link --manifest "$MANIFEST" \
  -I "$ANDROID_JAR" \
  -A "$ASSET_DIR" \
  --min-sdk-version 26 \
  --target-sdk-version 35 \
  -o "$UNSIGNED_APK" \
  "$COMPILED_RES"

# 10. Inject DEX files into APK
echo "Adding DEX to APK..."
python3 - <<PY
import zipfile, os

unsigned_apk = "$UNSIGNED_APK"
dex_dir = "$DEX_DIR"

with zipfile.ZipFile(unsigned_apk, 'a') as apk:
    for f in os.listdir(dex_dir):
        if f.endswith('.dex'):
            path = os.path.join(dex_dir, f)
            apk.write(path, f)
print("DEX files injected successfully.")
PY

# 11. Zipalign APK
echo "Aligning APK..."
ALIGNED_APK="$BUILD_DIR/aligned.apk"
"$ZIPALIGN" -f -p 4 "$UNSIGNED_APK" "$ALIGNED_APK"

# 12. Create Keystore if needed & Sign APK
KEYSTORE="$PROJECT_ROOT/android/local-debug.keystore"
if [[ ! -f "$KEYSTORE" ]]; then
  echo "Generating debug signing keystore..."
  keytool -genkeypair -keystore "$KEYSTORE" \
    -storepass android -alias androiddebugkey -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Yoruichi Local Development,O=Yoruichi,C=IN"
fi

ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/android"
mkdir -p "$ARTIFACTS_DIR"
FINAL_APK="$ARTIFACTS_DIR/Yoruichi-Mobile-v1.0.0.apk"

echo "Signing APK with apksigner..."
"$APKSIGNER" sign --ks "$KEYSTORE" \
  --ks-key-alias androiddebugkey \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$FINAL_APK" \
  "$ALIGNED_APK"

echo "Verifying APK..."
"$APKSIGNER" verify --verbose "$FINAL_APK"

echo "========================================="
echo "   BUILD SUCCESSFUL!                     "
echo "   Output: $FINAL_APK"
echo "   SHA256: $(sha256sum "$FINAL_APK" | awk '{print $1}')"
echo "========================================="
