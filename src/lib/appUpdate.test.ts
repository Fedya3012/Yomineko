import { describe, it, expect } from 'vitest';
import { checkAppUpdate } from './appUpdate';

const reply = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const release = {
  tag_name: 'v0.2.0', html_url: 'https://github.com/x/y/releases/tag/v0.2.0', body: 'Có gì mới',
  assets: [{ name: 'Yomineko.apk', browser_download_url: 'https://dl/apk' }, { name: 'Yomineko_0.2.0_x64-setup.exe', browser_download_url: 'https://dl/exe' }]
};

describe('checkAppUpdate', () => {
  it('reports a newer release with the right file for the platform', async () => {
    const android = await checkAppUpdate('0.1.0', 'x/y', 'android', reply(200, release));
    expect(android).toMatchObject({ status: 'available', update: { version: '0.2.0', downloadUrl: 'https://dl/apk' } });
    const windows = await checkAppUpdate('0.1.0', 'x/y', 'windows', reply(200, release));
    expect(windows).toMatchObject({ update: { downloadUrl: 'https://dl/exe' } });
  });
  it('says up-to-date when the release is the same, older, a draft, or does not exist yet', async () => {
    expect(await checkAppUpdate('0.2.0', 'x/y', 'android', reply(200, release))).toEqual({ status: 'up-to-date' });
    expect(await checkAppUpdate('0.3.0', 'x/y', 'android', reply(200, release))).toEqual({ status: 'up-to-date' });
    expect(await checkAppUpdate('0.1.0', 'x/y', 'android', reply(200, { ...release, prerelease: true }))).toEqual({ status: 'up-to-date' });
    expect(await checkAppUpdate('0.1.0', 'x/y', 'android', reply(404))).toEqual({ status: 'up-to-date' });
  });
  it('reports an error (instead of throwing) when offline', async () => {
    const offline = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
    expect((await checkAppUpdate('0.1.0', 'x/y', 'android', offline)).status).toBe('error');
    expect((await checkAppUpdate('0.1.0', 'x/y', 'android', reply(500))).status).toBe('error');
  });
});
