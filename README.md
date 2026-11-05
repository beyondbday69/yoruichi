# ⚡ Yoruichi — 3D AI Mobile Assistant

<p align="center">
  <img src="build/icon.png" width="128" height="128" alt="Yoruichi Icon" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(147, 51, 234, 0.4);" />
</p>

<p align="center">
  <b>Expressive 3D AI companion and voice assistant for Android phones, powered by Google Gemini.</b><br>
  <i>Controls your phone with voice commands in Hindi, Hinglish, and English.</i>
</p>

---

## 🌟 Features

- **🎮 Interactive 3D Real-time Hologram Avatar**:
  - Rendered with Three.js WebGL directly on device.
  - Natural eye tracking (head and gaze smoothly track user's touch / pointer parallax).
  - Procedural breathing, idle sway, realistic natural blinking, and emotional expressions.
  - Audio-reactive frequency equalizer rings and pulsing mouth sync when speaking.
  - Interactive gestures: **Wave**, **Smile**, **Sit**, **Stand**, and **Portrait / Full Body view**.

- **📱 Android Phone Control & Native Actions**:
  - **Launch Apps**: *"Open WhatsApp"*, *"YouTube kholo"*, *"Chrome open karo"*, *"Settings kholo"*, or any installed launcher app by name.
  - **YouTube Search**: *"Search YouTube for Hindi songs"*, *"YouTube pe Arijit Singh bajao"*.
  - **Web Search**: *"Google search weather today"*, *"Chrome pe search karo latest tech news"*.
  - **WhatsApp Messaging**: *"Message Rahul on WhatsApp: I'll be ten minutes late"* — resolves contacts locally, prepares a WhatsApp draft with the recipient and text, ready for you to review and send.
  - **Background Floating Voice Control**: Continue conversing with Yoruichi while using other apps with a floating mic control.

- **🗣️ Bilingual & Hinglish Voice Engine**:
  - Full voice conversation using Gemini Live & Android Text-To-Speech (TTS).
  - Understands and speaks natural **Hinglish**, **Hindi**, and **English**.

- **🔒 Privacy & Security First**:
  - Gemini API key is encrypted using AES-GCM via **Android Keystore** protected hardware storage.
  - Keys never leak into logs or UI.
  - Contact resolution and lookups occur 100% locally on your phone.

---

## 🚀 Quick Start & APK Download

### Method 1: Download from GitHub Actions / Releases
Every push or release automatically builds a signed APK:
1. Go to the **Actions** tab on this repository.
2. Select the latest **Build Yoruichi Android APK** workflow run.
3. Download the **`Yoruichi-Mobile-APK`** artifact, or check the **Releases** page for `Yoruichi-Mobile-v1.0.0.apk`.
4. Install on your Android phone (Android 8.0 / API 26 or later).

### Method 2: Build Locally (Linux / macOS)
Prerequisites: JDK 21, Android SDK (Platform 35, Build-tools 35.0.0), Bun / Node.js.

```bash
# 1. Install dependencies
bun install   # or npm install

# 2. Build the Android APK
bash scripts/build-android.sh
```
Output APK will be generated at `artifacts/android/Yoruichi-Mobile-v1.0.0.apk`.

### Method 3: Build Locally (Windows PowerShell)
```powershell
npm ci
pwsh -NoProfile -File scripts/build-android.ps1
```

---

## 🛠️ App Setup & First Run

1. Open **Yoruichi** on your phone.
2. Tap the **⚙ Settings** icon in the top right.
3. Enter your **Google Gemini API Key** (get one free from [Google AI Studio](https://aistudio.google.com/)).
4. Choose your preferred text & voice model (e.g. `gemini-2.5-flash`).
5. Tap **Save Settings** and **Check Key & Model**.
6. Tap **Talk** to start a live voice session, or type commands into the text box!

---

## 🗣️ Example Voice Commands

| What you say | What Yoruichi does |
|---|---|
| *"WhatsApp kholo"* | Opens WhatsApp |
| *"YouTube pe lofi songs search karo"* | Opens YouTube and searches for lofi songs |
| *"Search Google for best cafes in Delhi"* | Opens Google Chrome search |
| *"Rahul ko WhatsApp pe message karo: Main 5 minute mein aa raha hoon"* | Opens WhatsApp draft to Rahul with message |
| *"Wave"* / *"Smile"* | Yoruichi reacts with 3D animation and smile |

---

## 📂 Project Architecture

```text
yoruichi/
├── .github/workflows/
│   └── build-apk.yml           # Automated CI/CD for building & releasing APK
├── android/
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml # App permissions, services, package (com.yoruichi.mobile)
│   │   ├── java/com/yoruichi/mobile/
│   │   │   ├── MainActivity.java     # Native lifecycle, Keystore, WebView bridge
│   │   │   ├── LiveVoiceService.java # Foreground voice service & floating overlay
│   │   │   ├── MobileActions.java    # Native Android Intents for phone control
│   │   │   └── GeminiAccess.java     # Secure Gemini API metadata verification
│   │   └── res/                      # Icons, strings, themes
│   └── tests/                        # Verification instrumentation tests
├── src/
│   └── mobile/
│       ├── main.ts             # Mobile orchestrator & UI manager
│       ├── mobile.css          # Sleek violet & gold dark mode theme
│       ├── actions.ts          # Hinglish & English phone action command parser
│       └── Yoruichi3DAvatar.ts # Real-time 3D Holographic Cyber-Anime Avatar
├── scripts/
│   ├── build-android.sh        # Linux APK build automation script
│   ├── build-android.ps1       # Windows APK build automation script
│   └── generate_yoruichi_icon.py # App icon generator
└── package.json
```

---

## 📜 License & Notes
- Built for private and personal AI phone assistance.
- Uses standard Android APIs, WebGL Three.js, and Google Gemini API.
