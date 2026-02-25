describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('throws when SLACK_BOT_TOKEN is missing', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', '');
    vi.stubEnv('SLACK_SIGNING_SECRET', 'secret');
    await expect(() => import('../../src/config')).rejects.toThrow('SLACK_BOT_TOKEN');
  });

  it('throws when SLACK_SIGNING_SECRET is missing', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-token');
    vi.stubEnv('SLACK_SIGNING_SECRET', '');
    await expect(() => import('../../src/config')).rejects.toThrow('SLACK_SIGNING_SECRET');
  });

  it('uses default PORT 3000 when not set', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-token');
    vi.stubEnv('SLACK_SIGNING_SECRET', 'secret');
    vi.stubEnv('PORT', '');
    const { config } = await import('../../src/config');
    expect(config.PORT).toBe(3000);
  });

  it('parses custom PORT', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-token');
    vi.stubEnv('SLACK_SIGNING_SECRET', 'secret');
    vi.stubEnv('PORT', '8080');
    const { config } = await import('../../src/config');
    expect(config.PORT).toBe(8080);
  });

  it('uses default DATABASE_PATH when not set', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-token');
    vi.stubEnv('SLACK_SIGNING_SECRET', 'secret');
    vi.stubEnv('DATABASE_PATH', '');
    const { config } = await import('../../src/config');
    expect(config.DATABASE_PATH).toBe('./data/boss-tasks.db');
  });
});
