import type { CapacitorConfig } from '@capacitor/cli';

// Android shell around the same web build (dist/). The android/ folder is generated in CI
// (`npx cap add android`), so it is not committed.
const config: CapacitorConfig = {
  appId: 'app.yomineko',
  appName: 'Yomineko',
  webDir: 'dist',
  // Android 15+ draws apps edge-to-edge; this keeps the page out from under the status and navigation bars.
  android: { adjustMarginsForEdgeToEdge: 'force' }
};
export default config;
