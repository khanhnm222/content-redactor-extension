# Redactor - Sensitive Info Blur

<p align="center">
	<img src="public/icons/icon128.png" alt="Redactor logo" width="128" height="128" />
</p>

Redactor is a Chrome extension that automatically masks sensitive words and patterns on web pages. It helps reduce accidental exposure of private or confidential information while browsing, demoing, recording, or sharing your screen.

## What It Does

- Scans page content and embedded frames for matching terms.
- Supports both keyword and regex rules.
- Lets you control case sensitivity and whole-word matching.
- Applies rules globally or only for specific domains.
- Provides multiple mask styles: frosted, solid, and pixelated.
- Includes adjustable blur strength.

## How It Works

- The content script scans visible text nodes and applies redaction overlays.
- Rules and settings are stored with Chrome storage APIs.
- The side panel UI lets you add, enable, disable, and tune rules.
- A background service worker coordinates extension behavior and messaging.

## Tech Stack

- TypeScript
- React 18
- Vite 5
- CRXJS Vite Plugin (Manifest V3)
- Tailwind CSS 4
- Vitest

## Project Structure

- `src/background`: background service worker
- `src/content`: DOM scanning, overlays, observers, selection tracking
- `src/panel`: side panel React app and settings UI
- `src/shared`: shared types, messaging, storage, and rule matching
- `src/tests`: unit tests for rule matching behavior

## Development

Install dependencies:

```bash
npm install
```

Run dev mode:

```bash
npm run dev
```

Build extension:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Load in Chrome

1. Build the project with `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the generated `dist` folder.

## Permissions

This extension requests permissions used for:

- `storage`: save rules and settings
- `sidePanel`: render the management UI
- `tabs` and `activeTab`: detect the current site context
- `scripting` and host permissions (`<all_urls>`): scan and mask page content
- `contextMenus`: future quick actions