# Private File Uploader (React Native + WordPress)

A privacy-first mobile client for uploading **any file type** directly to **your own server**.
The app pairs with a **WordPress plugin** that exposes secure REST endpoints and leverages native WordPress user management and **Application Passwords** for authentication. No external cloud services are involved.

> **Status:** This repository currently contains the **mobile client only** with a **mocked network layer** for development.
> The required **WordPress server plugin** and the **real upload API integration** will be provided shortly.

---

## What it does (today)

* **Local-first client (React Native)**

  * Home screen with **file list**, empty state, **pull-to-refresh** (merges server mock with local pending items).
  * **Tap** → detail screen with metadata and **image preview** (if applicable).
  * **Long press** → contextual delete (+ **haptic feedback**) with **Undo** snackbar (soft delete).
  * **Swipe actions** on list items (Delete).
  * **Floating “+”** → file picker:

    * **Single selection:** uploads the chosen file.
    * **Multi-selection:** asks whether to upload as a **single ZIP** or **separate files**.
      For now we support **ZIP bundle** only.
  * **“Preparing ZIP…”** modal with **local progress** (staging + zip creation), then a separate **upload progress** modal.
  * **Cancel upload** (keeps the local ZIP on device), **Retry** failed/cancelled uploads.
  * **Smart progress throttling** to keep lists smooth.
* **Settings**

  * Store **Site URL**, **Username**, and **Application Password**.
  * URL is **normalized/validated** (http/https; auto-prepend `https://` if missing).
  * Password is stored in the **OS secure storage** (Keychain/Keystore), **not** in AsyncStorage.
  * **Reset app** button clears credentials and the local file list (and removes any secure password).
* **Data persistence**

  * Files list and non-secret settings are persisted in **AsyncStorage**.
  * Password lives in **secure storage** only.
* **Mocks (dev)**

  * **Mocked upload** (progress, success/failure).
  * **Mocked server list** for pull-to-refresh.

> **Important:** The **server plugin + real upload endpoints** are required for production and will be released soon, together with the client’s network layer wiring.

---

## How multi-file ZIP uploads work

1. User selects multiple files.
2. The app uses the picker’s **`keepLocalCopy`** to create **sandboxed local copies** (originals are never touched).
3. Copies are **staged** into a temporary batch folder, then compressed into a single **ZIP** on-device.
4. A **“Preparing ZIP…”** modal shows progress for:

   * **Staging** (0–30%)
   * **ZIP creation** via `react-native-zip-archive` subscribe (30–100%)
5. The resulting ZIP is uploaded (mock for now).

   * **On success:** the local ZIP is deleted from disk and the item is marked *uploaded*.
   * **On failure/cancel:** the local ZIP is **kept** on disk and the list shows a failed item; deleting that item from the list also removes the on-device ZIP. Non-ZIP items are never deleted from the device.

---

## Security model

* Auth uses **WordPress Application Passwords** over **HTTPS**.
* The client stores **Site URL** + **Username** in AsyncStorage; the **Password** is stored in **Keychain/Keystore**.
* The (upcoming) server plugin validates credentials, enforces MIME/size limits, and returns normalized metadata.

---

## Tech stack (client)

* React Native, React Navigation (native stack)
* Redux (vanilla) + react-redux
* react-native-gesture-handler (swipe / long-press)
* @react-native-documents/picker (`keepLocalCopy`) for selection
* react-native-zip-archive + react-native-fs for local ZIP creation and cleanup
* AsyncStorage (non-secret data), Keychain/Keystore (password)
* Haptics (Android requires `VIBRATE` permission)

---

## Project structure (high-level)

```
src/
  components/         # FAB, EmptyState, Snackbar, FileListItem, UploadProgressModal, ZipProgressModal, ...
  navigation/         # AppNavigator, types
  screens/            # HomeScreen, DetailsScreen, SettingsScreen, InfoScreen
  store/              # Redux store, reducers (auth, files), hooks
  types/              # Shared types (FileItem, UploadStatus, ...)
  utils/
    fs.ts             # FS helpers (paths, safe unlink, filename sanitize)
    zipBundle.ts      # Multi-file → ZIP pipeline (with progress)
    uploadMock.ts     # Mocked upload with progress/cancel/fail
    serverMock.ts     # Mocked server-side file list
    validation.ts     # URL normalization/validation
    secure.ts         # Keychain/Keystore helpers
    storage.ts        # AsyncStorage persistence (non-secret)
```

---

## Getting started

### Requirements

* Node, watchman, Android/iOS toolchains
* **iOS Deployment Target**: currently **16.0+** (due to generated pods / dependencies)
* CocoaPods

### Install & run

```bash
# install deps
npm install

# iOS pods
cd ios
pod install --repo-update
cd ..

# run
npx react-native run-android
# or
npx react-native run-ios
```

**iOS Podfile hint:** if you see deployment target errors, set and enforce the platform:

```ruby
platform :ios, '16.0'

post_install do |installer|
  react_native_post_install(installer, config[:reactNativePath], :mac_catalyst_enabled => false)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0' if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 16.0
    end
  end
end
```

---

## Server component (WordPress plugin) — coming soon

This app relies on a dedicated **WordPress plugin** (to be released shortly) that provides:

* **REST endpoints** under `/wp-json/fileuploader/v1/...`
* Authentication via **Application Passwords**
* Server-side validation: MIME, size limits, per-user quotas
* File storage in the WordPress filesystem / Media Library (configurable)
* Responses with normalized metadata: `{ id, name, size, mime, url, ... }`

> When the plugin and network layer are published, this README will be updated with installation, configuration, and endpoint details.

---

## Roadmap

* Upload files **separately** (per-file progress) for multi-select
* Background/resumable uploads
* Real server integration (replace mocks)
* Per-user quotas & role policies
* Optional **end-to-end encryption** before upload
* Better conflict handling and error UX (e.g., partial failures, retries queue)

---

## Contributing

Contributions are welcome — issues and pull requests help the project move forward.

**Guidelines**
- Keep PRs focused and reasonably small; explain the “why” in the description.
- Use clear commit messages (Conventional Commits are appreciated).
- Follow the existing code style and TypeScript strictness.
- When adding native dependencies, include iOS/Android setup notes (e.g., Podfile changes, required permissions).
- Update or add documentation when behavior or public APIs change.
- Don’t include secrets or credentials in code or test fixtures.

**Quality checks**
- Ensure the app builds and runs on both Android and iOS.
- Run type checks and linters (and tests, if present) before submitting.

By contributing, you agree that your contributions will be licensed under the project’s MIT License.

---

## License

MIT — see [LICENSE](./LICENSE).
