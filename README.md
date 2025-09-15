# Private File Uploader (React Native + WordPress)

A privacy-first mobile client for uploading **any file type** directly to **your own server**.  
The app pairs with a **WordPress plugin** that exposes secure REST endpoints and leverages native WordPress user management and **Application Passwords** for authentication. No external cloud services are involved.

## What it does
- **Local-first mobile client (React Native)**
  - Home screen with a **file list**, empty state, and a floating **“+”** action button.
  - **Tap** an item → detail screen with metadata and **image preview** (if applicable).
  - **Long press** → context menu (Delete).
  - **Swipe actions** on list items (Delete).
  - **Single-file picker** with a **blocking, inline progress** indicator during upload.
  - **Settings screen** to store an **Application Password** used for authenticated uploads.
  - **Info screen** for app details and help.
- **Server component (WordPress plugin)**
  - Uses **WordPress users/roles** and **Application Passwords** for per-user access.
  - Provides a secure **REST endpoint** for file uploads (HTTPS required).
  - Handles MIME checks, size limits, and returns normalized metadata (id, name, size, mime, URL).
  - Designed for private/self-hosted deployments; files stay on **your infrastructure**.

## Security model
- The client authenticates using a **WordPress Application Password** over **HTTPS**.
- By default, the app stores the credential locally (configurable).  
  For production deployments, we recommend integrating platform secure storage (Keychain/Keystore).
- The server plugin validates credentials on each request and enforces server-side rules (size, MIME, user quotas).

## Tech stack (client)
- React Native, React Navigation (native stack)
- Vanilla Redux + react-redux (stores the “Application Password” and basic UI state)
- Gesture handling for swipe/long-press
- Document picker for file selection
- Upload progress with a blocking modal

## Server (WordPress plugin)
- WordPress ≥ 6.x, PHP ≥ 8.x
- Exposes REST endpoints under `/wp-json/fileuploader/v1/...`
- Auth via WordPress **Application Passwords** (per user)
- Stores uploads in the WordPress filesystem/media library (or a dedicated directory), returning file metadata

## Roadmap
- Multi-file and folder selection
- Background/resumable uploads
- Per-user quotas and granular role policies
- Optional client-side encryption (end-to-end) before upload
- Secure storage integration (Keychain/Keystore)

> This repository contains the **mobile client**. The WordPress plugin (server component) is provided separately.
