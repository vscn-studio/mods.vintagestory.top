import { describe, expect, it } from 'vitest';
import { bilibiliEmbedUrl } from '@/lib/bilibili';
import { sanitizeRichText } from '@/lib/rich-text';

describe('project rich text', () => {
  it('converts public Bilibili links to player embeds', () => {
    expect(bilibiliEmbedUrl('https://www.bilibili.com/video/BV1xx411c7mD?p=2'))
      .toBe('https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=2&high_quality=1&danmaku=0');
  });

  it('keeps only Bilibili iframe embeds and safe markup', () => {
    expect(sanitizeRichText('<p>Update</p><iframe src="https://www.bilibili.com/video/BV1xx411c7mD"></iframe><iframe src="https://example.com/embed"></iframe><script>alert(1)</script>'))
      .toContain('src="https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&amp;page=1&amp;high_quality=1&amp;danmaku=0"');
    expect(sanitizeRichText('<iframe src="https://example.com/embed"></iframe>')).toBe('<span></span>');
  });
});
