# Private File Uploader (React Native + WordPress)

A privacy-first mobile client for uploading **any file type** directly to **your own server**.
The app pairs with a **WordPress plugin** that exposes secure REST endpoints and leverages native WordPress user management and **Application Passwords** for authentication. No external cloud services are involved.

> **Status:** This repository contains the **mobile client** wired to the **real WordPress REST API** for:
>
> * authenticated **file uploads** (multipart)
> * **server-side listing** with pagination
>
> You still need to install the **WordPress server plugin** (see section below) and set your **Site URL / Username / Application Password** in Settings.

---

## What it does (today)

* **Local-first client (React Native)**

  * Home screen with **file list**, **initial blocking sync** at app start (when credentials exist), and **pull-to-refresh**.
  * **Tap** → detail screen with metadata and **image preview** (if applicable).
  * **Long press** on list item → **copy server URL** to clipboard + short toast.
  * **Swipe actions** on list items (Delete – local list; server-side delete integration is planned).
  * **Floating “+”** → file picker:

    * **Single selection:** uploads the chosen file.
    * **Multi-selection:** offers **ZIP bundle** upload (all files as one ZIP). *Uploading individually will come next.*
  * **“Preparing ZIP…”** modal with **local progress** (staging + zip creation), then a separate **upload progress** modal.
  * **Cancel upload** (keeps the local ZIP on device), **Retry** failed/cancelled uploads.
  * **Smart progress throttling** to keep the UI smooth.
* **Settings**

  * Store **Site URL**, **Username**, and **Application Password**.
  * URL is **normalized/validated** (http/https; auto-prepend `https://` if missing).
  * Password is stored in the **OS secure storage** (Keychain/Keystore), **not** in AsyncStorage.
  * **Reset app** button clears credentials and the local file list (and removes any secure password).
* **Data persistence**

  * Files list and non-secret settings are persisted in **AsyncStorage**.
  * Password lives in **secure storage** only.

---

## How multi-file ZIP uploads work

1. User selects multiple files.
2. The app uses the picker’s **`keepLocalCopy`** to create **sandboxed local copies** (originals are never touched).
3. Copies are **staged** into a temporary batch folder, then compressed into a single **ZIP** on-device.
4. A **“Preparing ZIP…”** modal shows progress for:

   * **Staging** (0–30%)
   * **ZIP creation** via `react-native-zip-archive` subscribe (30–100%)
5. The resulting ZIP is uploaded to your WordPress server.

   * **On success:** the local ZIP is deleted from disk, the item is marked *uploaded*, and its **server URL** is stored.
   * **On failure/cancel:** the local ZIP is **kept** on disk and the list shows a failed item; deleting that item also removes the on-device ZIP. Non-ZIP items are never deleted from the device.

---

## Security model

* Auth uses **WordPress Application Passwords** over **HTTPS**.
* The client stores **Site URL** + **Username** in AsyncStorage; the **Password** is stored in **Keychain/Keystore**.
* The server plugin validates credentials, enforces MIME/size limits, and returns normalized metadata.

> For strict privacy, consider serving downloads via an **authenticated endpoint** (and denying direct public access to the upload directory). This will be offered as an option in the plugin.

---

## Tech stack (client)

* React Native, React Navigation (native stack)
* Redux (vanilla) + react-redux
* react-native-gesture-handler (swipe / long-press)
* @react-native-documents/picker (`keepLocalCopy`) for selection
* react-native-zip-archive + react-native-fs for local ZIP creation and cleanup
* XMLHttpRequest + FormData for **upload with progress/cancel** (with automatic `wp-json` → `index.php?rest_route=` fallback)
* AsyncStorage (non-secret data), Keychain/Keystore (password)
* Haptics (Android requires `VIBRATE` permission)
* Clipboard: long-press copies the **server URL** with a toast

---

## Project structure (high-level)

```
src/
  components/         # FAB, EmptyState, Snackbar, FileListItem, UploadProgressModal, ZipProgressModal, BlockingLoaderModal, ...
  navigation/         # AppNavigator, types
  screens/            # HomeScreen, DetailsScreen, SettingsScreen, InfoScreen
  store/              # Redux store, reducers (auth, files), hooks
  types/              # Shared types (FileItem, UploadStatus, ...)
  utils/
    fs.ts             # FS helpers (paths, safe unlink, filename sanitize)
    zipBundle.ts      # Multi-file → ZIP pipeline (with progress)
    uploadReal.ts     # Real upload adapter (ZIP | single file)
    httpUpload.ts     # XHR FormData upload with progress/cancel and URL fallback
    filesApi.ts       # GET /files (pagination)
    api.ts            # URL/auth helpers (normalize, Basic header)
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
      if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 16.0
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
      end
    end
  end
end
```

**Dev over HTTP (local):**

* Android: set `android:usesCleartextTraffic="true"` in `AndroidManifest.xml` (or a proper `network_security_config`).
* iOS: allow ATS for dev in `Info.plist` (only for local testing).

---

## Server component (WordPress plugin)

This app relies on a dedicated **WordPress plugin** that provides:

* **REST endpoints** under `/wp-json/fileuploader/v1/...`
* Authentication via **Application Passwords**
* Server-side validation: **MIME allowlist** and **max upload size** (configurable via WP filters)
* Per-user storage under `uploads/media/private-file-uploader/<username>`
* Responses with normalized metadata: `{ file, url, size, mime, owner, ... }`
* Listing (`GET /files`), HEAD metadata, and Delete endpoints

👉 **Install the WordPress plugin:**  [WordPress Private File Uploader Plugin](https://github.com/daniloercoli/ReactNative-FileUploader-WP-plugin)


---

## Roadmap

**Client**

* **Multi-file “separate uploads”** (per-file progress and cancel), in addition to ZIP bundles
* **Background / resumable** uploads (e.g., WorkManager / BGTaskScheduler)
* **Server-side delete** integration from the list (wired to `DELETE /files/{filename}`)
* **HEAD-based quick metadata** on demand to refresh stale items without full listing
* **Conflict handling** and richer **retry queue** (backoff, per-error policies)
* Optional **end-to-end encryption** (client-side) before upload
* Better **pagination UI** for large libraries (leveraging server paging)

**Server (plugin)**

* Admin settings page for **MIME allowlist** and **max size** (today configurable via filters)
* Option to **disable public direct URLs** and serve downloads via **authenticated endpoint** only
* Optional **per-user quotas** and role-based policies
* Extended metadata and search (filename/mime/date), with pagination & sorting

---

## Contributing

Contributions are welcome — issues and pull requests help the project move forward.

**Guidelines**

* Keep PRs focused and reasonably small; explain the “why” in the description.
* Use clear commit messages (Conventional Commits are appreciated).
* Follow the existing code style and TypeScript strictness.
* When adding native dependencies, include iOS/Android setup notes (e.g., Podfile changes, required permissions).
* Update or add documentation when behavior or public APIs change.
* Don’t include secrets or credentials in code or test fixtures.

**Quality checks**

* Ensure the app builds and runs on both Android and iOS.
* Run type checks and linters (and tests, if present) before submitting.

By contributing, you agree that your contributions will be licensed under the project’s MIT License.

---

## License

MIT — see [LICENSE](./LICENSE).
