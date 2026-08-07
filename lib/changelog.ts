import sanitizeHtml from 'sanitize-html';

const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'code', 'pre', 'a'];

export function sanitizeChangelog(value: string | null | undefined): string {
  return sanitizeHtml(value ?? '', {
    allowedTags,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto']
  }).trim();
}
