# SWCNT Lite Spectra (Mobile PWA)

This is a lightweight mobile-first SWCNT app for:

- Input `n` and `m` directly and generate pseudo-Voigt absorption spectra
- Overlay multiple species to compare peak positions
- View basic tube properties from data files (diameter, chiral angle, RBM, transitions)
- Exclude SDS% from displayed property table

Data source files:

- `data/swcnt_info_semiconducting.csv`
- `data/swcnt_info_metallic.csv`

## Run Locally

From this folder:

```bash
cd "/Users/hanli/codex project/SWCNT app/swcnt-mobile-lite"
python3 -m http.server 8765
```

Then open:

- `http://localhost:8765` on desktop, or
- `http://<your-lan-ip>:8765` on phone in same network

If you start server from parent folder instead:

```bash
cd "/Users/hanli/codex project/SWCNT app"
python3 -m http.server 8765
```

Then URL must be:

- `http://localhost:8765/swcnt-mobile-lite/`

## Troubleshooting (Mac)

- No reaction in browser:
  - Check you opened `http://localhost:8765` (or `/swcnt-mobile-lite/` if started from parent).
  - Do not double-click `index.html` directly (`file://` mode blocks data loading).
- Port in use:
  - Change port: `python3 -m http.server 8877`
- Still blank:
  - Hard refresh (`Cmd+Shift+R`) or clear browser cache/site data once.
  - If installed as PWA before, remove old home-screen app and re-add it once after refresh.

## Install On Phone

Android (Chrome):

1. Open the app URL.
2. Tap browser menu.
3. Tap `Install app` or `Add to Home Screen`.

iPhone/iPad (Safari):

1. Open the app URL.
2. Tap Share button.
3. Tap `Add to Home Screen`.

## Notes

- Spectrum shape uses pseudo-Voigt approximation for fast mobile rendering.
- Metallic curves use `M11-`, `M11+`, and `M11` (if present).
- Semiconducting curves use `S11` and `S22`.
- Service worker enables offline reuse after first load.

## Optional Native Packaging (Android/iOS Store Path)

If you later want app-store style binaries:

1. Wrap this web app with Capacitor.
2. Build Android/iOS projects from the same web assets.
3. Use Android Studio / Xcode for signing and publishing.

This keeps one codebase for both platforms.

## Local Native App (Done)

This project is now wrapped by Capacitor and has native projects:

- `android/`
- `ios/`

Config file:

- `capacitor.config.json` with:
  - appId: `com.hanli.swcntlite`
  - appName: `SWCNT Lite Spectra`
  - webDir: `www`

### Build Web Assets Into Native Shell

From `swcnt-mobile-lite`:

```bash
npm run cap:sync
```

This rebuilds web files into `www/` and copies them into both native projects.

### Android (Local App)

Prerequisites:

- Java JDK 21+
- Android Studio
- Android SDK installed

Commands:

```bash
npm run android:open
```

or build debug APK from CLI:

```bash
npm run android:build:debug
```

APK output (debug):

- `android/app/build/outputs/apk/debug/app-debug.apk`

### iOS (Local App)

Prerequisites:

- Full Xcode app (not only Command Line Tools)
- CocoaPods (usually managed by Xcode/Capacitor workflow)

Command:

```bash
npm run ios:open
```

Then build/run in Xcode to your iPhone (or archive for distribution).

## GitHub Sharing (Web + Android + iOS)

This repo now includes GitHub Actions workflows:

- `.github/workflows/pages.yml`:
  - Builds web assets and deploys to GitHub Pages
- `.github/workflows/android-apk.yml`:
  - Builds Android debug APK
  - Uploads APK as workflow artifact on `main` pushes
  - Auto-attaches APK to GitHub Release when pushing tags like `v1.0.0`

### 1. Push To GitHub

From repo root:

```bash
cd "/Users/hanli/codex project/SWCNT app"
git add .
git commit -m "Prepare GitHub deployment workflows"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Web Version (GitHub Pages)

In GitHub repo settings:

1. Open `Settings` -> `Pages`
2. Set `Build and deployment` source to `GitHub Actions`
3. After workflow finishes, web app URL will appear in Actions/Pages output

### 3. Android Direct Install

#### Option A: Download APK From Actions (every push to `main`)

1. Open repo page: `https://github.com/<your-user>/<your-repo>`
2. Click `Actions`
3. Open workflow run: `Build Android APK`
4. Wait until it is green (`Success`)
5. Scroll to `Artifacts`, download `swcnt-lite-debug-apk`
6. Unzip it, you will get: `app-debug.apk`

If you cannot find the file:

- Make sure you opened the workflow run details page (not only the workflow list page)
- Check the run status is `Success` (failed runs do not provide APK artifact)
- Wait 1-3 minutes after success for artifact panel to appear

#### Option B: APK In GitHub Releases (better for sharing link)

From local repo root:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Then:

1. Open `Releases` in your GitHub repo
2. Open release `v1.0.0`
3. Download asset `app-debug.apk`

This path is better for sharing because users can download from the release page directly.

### 4. iOS Sharing

GitHub can share the iOS project source (`ios/`), but iOS app install still needs Apple signing.

- Free Apple ID: install to your own device via Xcode (temporary dev build)
- Paid Apple Developer: TestFlight / App Store distribution

## Quick Troubleshooting (GitHub)

- `remote rejected ... without workflow scope` when `git push`:
  - Your PAT is missing workflow permission
  - Create new PAT with at least `repo` and `workflow`
- `Repository not found`:
  - Check `git remote -v` URL and repo name
  - Confirm the repo exists and your account has access
