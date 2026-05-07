# NoteKit Frontend (React Native + Expo)

## Setup

1. Open terminal in `frontend`
2. Run: `npm install`
3. Start app: `npm run start`

## API Base URL

The app now tries to detect the backend host automatically from the Expo/Metro URL.
If that still does not match your setup, open Settings in the app and override the API base URL manually.

- Android emulator: `http://10.0.2.2:8000`
- iOS simulator: `http://localhost:8000`
- Physical device with Expo Go: `http://<your-computer-lan-ip>:8000`

## EAS APK Build

This project already uses the Expo managed workflow, so it is suitable for EAS Build.

### Config added

- `app.json` includes `android.package` as `com.kalkeesh.notekit`
- `eas.json` includes a `preview` profile that builds an Android APK

### One-time setup

1. Open terminal in `frontend`
2. Install EAS CLI with `npm install -g eas-cli`
3. Run `eas login`
4. Run `eas build:configure`

### Build the APK

Run `eas build -p android --profile preview`

Expo will build the APK in the cloud and provide a download link when it finishes.

### Save the build link to a text file

After the build completes, run:

`powershell -ExecutionPolicy Bypass -File .\scripts\save-latest-apk-link.ps1`

This saves the latest finished Android build URL to `frontend\apk-link.txt`.

### Troubleshooting

- If `eas` is not recognized, reinstall it with `npm install -g eas-cli`
- If Expo prompts to link the project, complete that flow during `eas build:configure`
- If package validation fails, run `npx expo install --check` on a machine with internet access and apply the recommended version updates
- If Android credentials are missing, let EAS generate the keystore when prompted
- If the APK cannot reach your backend, set `EXPO_PUBLIC_API_BASE_URL` before starting the build
- Keep using the `preview` profile for installable APK output because default Android cloud builds are usually `.aab`
