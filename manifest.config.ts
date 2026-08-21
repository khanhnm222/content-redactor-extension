import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Redactor — Sensitive Info Blur',
  version: pkg.version,
  description: pkg.description,
  permissions: ['storage', 'scripting', 'activeTab', 'tabs', 'sidePanel', 'contextMenus'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  side_panel: {
    default_path: 'src/panel/index.html',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
    },
  ],
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
})
