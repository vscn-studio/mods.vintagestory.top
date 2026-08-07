import sanitizeHtml from 'sanitize-html';
import { bilibiliEmbedUrl } from '@/lib/bilibili';

const richTextTags = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'code', 'pre', 'a',
  'hr', 'div', 'span', 'figure', 'figcaption', 'img', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'iframe'
];

function dimension(value: string | undefined, fallback: string): string {
  if (value === '100%') return value;
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed >= 80 && parsed <= 1600 ? String(parsed) : fallback;
}

const transformIframe: sanitizeHtml.Transformer = (_tagName, attributes): sanitizeHtml.Tag => {
  const src = bilibiliEmbedUrl(attributes.src ?? '');
  if (!src) return { tagName: 'span', attribs: {} as sanitizeHtml.Attributes, text: '' };
  return {
    tagName: 'iframe',
    attribs: {
      src,
      width: dimension(attributes.width, '100%'),
      height: dimension(attributes.height, '520'),
      frameborder: '0',
      allowfullscreen: 'true',
      allow: 'autoplay; fullscreen',
      loading: 'lazy'
    }
  };
};

export function sanitizeRichText(value: string | null | undefined): string {
  return sanitizeHtml(value ?? '', {
    allowedTags: richTextTags,
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'width', 'height'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'loading'],
      table: ['width'],
      th: ['colspan', 'rowspan', 'style'],
      td: ['colspan', 'rowspan', 'style'],
      p: ['style'],
      h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], h5: ['style'], h6: ['style'],
      div: ['style'], span: ['style']
    },
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/]
      }
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['player.bilibili.com'],
    allowIframeRelativeUrls: false,
    transformTags: {
      iframe: transformIframe
    }
  }).trim();
}
