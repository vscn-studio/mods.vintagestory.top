'use client';

import { useEffect, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';

type MvlPlatform = 'Windows' | 'Linux';

function detectPlatform(): MvlPlatform {
  const agent = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  return agent.includes('linux') && !agent.includes('android') ? 'Linux' : 'Windows';
}

export function MvlPage() {
  const language = useSiteLanguage();
  const [platform, setPlatform] = useState<MvlPlatform>('Windows');
  const isEnglish = language === 'en';

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const title = isEnglish
    ? "MystiVaid's VintageStory Launcher (MVL)"
    : `下载适用于 ${platform} 的 神麤詭末的复古物语启动器（MVL）`;
  const description = isEnglish
    ? "MystiVaid's VintageStory Launcher (MVL) is a free, open-source, community-driven launcher for Vintage Story, supports both Windows and Linux systems."
    : '神麤詭末的复古物语启动器（MVL）是一个免费、开源、由社区驱动的复古物语启动器，支持Windows与Linux系统。';
  const downloadLabel = isEnglish ? 'Download MVL' : '下载 MVL';
  const platformLabel = isEnglish ? platform : `${platform} 版`;
  const platformIcon = platform === 'Linux' ? '/brand/mvl-linux.svg' : '/brand/mvl-windows.svg';
  const releaseVersion = '1.0.1';

  return (
    <section className="mvl-page" aria-labelledby="mvl-title">
      <div className="mvl-page__inner">
        <span className="mvl-version">
          {isEnglish ? `Release ${releaseVersion}` : `版本号 ${releaseVersion}`}
        </span>

        <div className="mvl-page__intro">
          <h1 id="mvl-title">{title}</h1>
          <p>{description}</p>
        </div>

        <div className="mvl-downloads" aria-label={isEnglish ? `MVL download for ${platform}` : `下载 ${platformLabel} MVL`}>
          <button
            className="mvl-download-button"
            type="button"
            aria-label={isEnglish ? `Download MVL for ${platform}` : `下载 ${platformLabel} MVL`}
            title={isEnglish ? `Download MVL for ${platform}` : `下载 ${platformLabel} MVL`}
          >
            <img className="mvl-download-button__icon" src={platformIcon} alt="" aria-hidden="true" />
            <span>{downloadLabel}</span>
          </button>
        </div>

        <figure className="mvl-preview">
          <img
            src="/brand/mvl.png"
            alt={isEnglish ? 'MystiVaid VintageStory Launcher interface' : '神麤詭末的复古物语启动器界面截图'}
          />
        </figure>
      </div>
    </section>
  );
}
