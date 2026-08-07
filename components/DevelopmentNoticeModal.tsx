'use client';

import { TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import type { SiteLanguage } from '@/lib/site-language';

type DevelopmentNoticeModalProps = {
  language: SiteLanguage;
  onClose: () => void;
};

const copy = {
  'zh-CN': {
    close: '关闭开发提示',
    eyebrow: 'VSCN MOD DB',
    title: '网站开发中',
    message: '网站还处于开发中，一切数据均可能随时清理，请勿正式提交模组！',
    detail: '当前版本用于功能测试和体验反馈，正式内容请等待网站发布公告。',
    acknowledge: '我知道了'
  },
  en: {
    close: 'Close development notice',
    eyebrow: 'VSCN MOD DB',
    title: 'Website in development',
    message: 'This website is still under development. All data may be cleared at any time. Please do not submit mods for production use.',
    detail: 'This version is for feature testing and feedback. Please wait for the release announcement before submitting final content.',
    acknowledge: 'I understand'
  }
} as const;

export function DevelopmentNoticeModal({ language, onClose }: DevelopmentNoticeModalProps) {
  const text = copy[language];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="auth-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="auth-modal development-notice-modal" role="dialog" aria-modal="true" aria-labelledby="development-notice-title" aria-describedby="development-notice-message">
        <button className="auth-modal__close" type="button" aria-label={text.close} onClick={onClose}>
          <X size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <div className="auth-modal__heading development-notice-modal__heading">
          <span className="auth-modal__eyebrow">{text.eyebrow}</span>
          <h2 id="development-notice-title">{text.title}</h2>
        </div>
        <div className="auth-modal__intro development-notice-modal__body">
          <span className="development-notice-modal__icon" aria-hidden="true"><TriangleAlert size={30} strokeWidth={1.7} /></span>
          <strong id="development-notice-message">{text.message}</strong>
          <span>{text.detail}</span>
          <button className="auth-modal__primary" type="button" onClick={onClose}>{text.acknowledge}</button>
        </div>
      </section>
    </div>
  );
}
