export type PreviewSection = 'description' | 'screenshots' | 'changelog' | 'versions';

export function isPreviewSection(value: string): value is PreviewSection {
  return value === 'description' || value === 'screenshots' || value === 'changelog' || value === 'versions';
}
