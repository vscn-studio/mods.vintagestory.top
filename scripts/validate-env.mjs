const secret = (process.env.MOD_AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET || '').trim();

if (process.env.NODE_ENV === 'production' && secret.length < 32) {
  console.error('MOD_AUTH_SESSION_SECRET must be set to a random value of at least 32 characters in production.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  const webUrl = (process.env.WEB_URL || '').trim();
  let webOrigin = '';
  if (!webUrl) {
    console.error('WEB_URL must be configured in production.');
    process.exit(1);
  }
  try {
    const parsed = new URL(webUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('WEB_URL must be a public HTTPS origin');
    }
    webOrigin = parsed.origin;
  } catch {
    console.error('WEB_URL must be a public HTTPS URL in production.');
    process.exit(1);
  }

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpFrom = (process.env.SMTP_FROM || '').trim();
  const smtpPort = Number.parseInt((process.env.SMTP_PORT || '587').trim(), 10);
  const smtpSecure = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPassword = process.env.SMTP_PASSWORD || '';
  if (!smtpHost || /[\s\r\n]/.test(smtpHost) || !smtpFrom || /[\r\n]/.test(smtpFrom)) {
    console.error('SMTP_HOST and SMTP_FROM must be configured in production.');
    process.exit(1);
  }
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    console.error('SMTP_PORT must be an integer between 1 and 65535.');
    process.exit(1);
  }
  if (smtpSecure && !['1', 'true', 'yes', 'on', '0', 'false', 'no', 'off'].includes(smtpSecure)) {
    console.error('SMTP_SECURE must be a boolean value.');
    process.exit(1);
  }
  if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword)) {
    console.error('SMTP_USER and SMTP_PASSWORD must be configured together.');
    process.exit(1);
  }

  const httpsOnly = [
    ['OIDC_ISSUER', process.env.OIDC_ISSUER || 'https://connect.vintagestory.top'],
    ['OIDC_REDIRECT_URI', process.env.OIDC_REDIRECT_URI],
    ['VS_AUTH3_LOGIN_URL', process.env.VS_AUTH3_LOGIN_URL || 'https://auth3.vintagestory.at/v2/gamelogin'],
    ['VS_API_LATEST_UNSTABLE_URL', process.env.VS_API_LATEST_UNSTABLE_URL || 'https://api.vintagestory.at/latestunstable.txt']
  ];
  for (const [name, value] of httpsOnly) {
    if (!value) continue;
    try {
      if (new URL(value).protocol !== 'https:') throw new Error('must use HTTPS');
    } catch {
      console.error(`${name} must be a valid HTTPS URL in production.`);
      process.exit(1);
    }
  }

  const redirectUri = (process.env.OIDC_REDIRECT_URI || '').trim();
  if (redirectUri && new URL(redirectUri).origin !== webOrigin) {
    console.error('OIDC_REDIRECT_URI must use the same origin as WEB_URL.');
    process.exit(1);
  }
}
