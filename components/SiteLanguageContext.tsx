'use client';

import { createContext, useContext } from 'react';
import type { SiteLanguage } from '@/lib/site-language';

export const SiteLanguageContext = createContext<SiteLanguage>('zh-CN');

export function useSiteLanguage(): SiteLanguage {
  return useContext(SiteLanguageContext);
}
