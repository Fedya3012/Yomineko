import type { CapacitorConfig } from '@capacitor/cli';

// Android shell around the same web build (dist/). The android/ folder is generated in CI
// (`npx cap add android`), so it is not committed.
const config: CapacitorConfig = {
  appId: 'app.yomineko',
  appName: 'Yomineko',
  webDir: 'dist'
};
export default config;
