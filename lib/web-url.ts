export function publicOrigin(request: Request): string {
  const configured = (process.env.WEB_URL ?? '').trim();
  if (!configured) return new URL(request.url).origin;

  const url = new URL(configured);
  return url.origin;
}

export function publicUrl(request: Request, pathname: string): URL {
  return new URL(pathname, `${publicOrigin(request)}/`);
}
