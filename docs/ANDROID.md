# Android APK

This project ships the existing Web Gomoku game inside a Capacitor Android
WebView. The game logic, QI teaching mode, and LLM settings remain in the Web
app.

## Build

Prerequisites:

- Node.js and npm
- Android Studio or Android SDK with API 36 installed
- JDK 17 or newer

Commands:

```bash
npm install
npm run android:build:debug
```

The installable debug APK is copied to:

```text
output/android/Gomoku-1.0.0-debug.apk
```

The raw Gradle output is also available at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

To work in Android Studio:

```bash
npm run android:open
```

The app ID is `com.gomoku.game`, the display name is `Gomoku`, and Android
devices must run API 24 or newer.

## Install For Testing

The generated `Gomoku-1.0.0-debug.apk` is debug-signed and can be side-loaded on
a phone or emulator. Android may ask you to allow installs from unknown sources
for the file manager, browser, or ADB tool you use.

Install over USB or emulator:

```bash
~/Android/Sdk/platform-tools/adb install -r output/android/Gomoku-1.0.0-debug.apk
```

## Android UI Adaptation

- The Android build is portrait-first.
- The WebView uses safe-area padding and `100dvh` sizing to avoid top and bottom
  clipping on modern Android devices.
- High-frequency game actions use icon buttons. On phones, the bottom game
  toolbar keeps accessible labels but visually prioritizes icons to reduce
  horizontal overflow.
- Tap-to-place still uses the existing two-step flow: select a point, then
  confirm the move.

## LLM Endpoint Notes

LLM teaching uses the existing in-app settings and stores Base URL, Model, and
API Key in localStorage. Requests are sent directly to:

```text
<Base URL>/v1/chat/completions
```

For local OpenAI-compatible services:

- Android emulator to host machine: use `http://10.0.2.2:<port>`
- Physical device: use the host machine's LAN IP, for example `http://192.168.1.20:<port>`
- The local service must listen on a reachable interface, and the firewall must allow the port.

This v1 Android build allows cleartext HTTP so local and LAN model gateway
testing works. Tighten the network security policy before Play Store release.
