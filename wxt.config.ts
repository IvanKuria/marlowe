import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Marlowe',
    // Kept under 132 characters; the store truncates the rest in listings.
    description:
      'A cat sits on your pages and writes a novel out of your typing. It counts keystrokes only, never what you type.',
    // No host_permissions. Statically declared content scripts are injected
    // from their own `matches` and never consult host_permissions, so the only
    // thing the broad grant was buying was `tab.url` in the popup, which
    // activeTab covers on click. Dropping it removes a permission reviewers
    // scrutinise without changing behaviour.
    // VERIFY ON A REAL LOAD before submitting: if the cat stops appearing,
    // this assumption is wrong and <all_urls> goes back.
    permissions: ['storage', 'activeTab'],
    action: {
      default_title: 'Marlowe',
    },
    minimum_chrome_version: '110',
  },
  vite: () => ({
    build: {
      // The sprite sheets are imported with `?inline`, which produces large
      // base64 data URIs on purpose (see entrypoints/content/sprites.ts).
      chunkSizeWarningLimit: 4000,
    },
  }),
});
