'use client';

import { Building2, CheckCircle2, Plus, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useSiteLanguage } from '@/components/SiteLanguageContext';
import { ensureCsrfToken } from '@/lib/client-confirmation';

type Props = { onClose: () => void; onCreated?: (organization: { id: string; slug: string }) => void };

const copy = {
  'zh-CN': { title: '创建组织', slug: '组织 URL', name: '组织名称', description: '组织介绍', slugHint: '仅使用小写字母、数字和连字符。', submit: '创建组织', cancel: '取消', success: '组织已创建', successDescription: '组织资料已保存，可以开始邀请成员和创建项目。', done: '完成', error: '创建组织失败。', close: '关闭创建组织窗口' },
  en: { title: 'Create organization', slug: 'Organization URL', name: 'Organization name', description: 'Description', slugHint: 'Use lowercase letters, numbers, and hyphens.', submit: 'Create organization', cancel: 'Cancel', success: 'Organization created', successDescription: 'The organization is ready for invitations and projects.', done: 'Done', error: 'Organization creation failed.', close: 'Close create organization dialog' }
} as const;

export function CreateOrganizationModal({ onClose, onCreated }: Props) {
  const language = useSiteLanguage();
  const text = copy[language];
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler); }, [onClose]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const token = await ensureCsrfToken();
      const response = await fetch('/api/v1/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-csrf-token': decodeURIComponent(token) } : {}) }, body: JSON.stringify({ slug, name, description }) });
      const payload = await response.json().catch(() => ({})) as { data?: { id: string; slug: string }; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? text.error);
      setCreated(payload.data); onCreated?.(payload.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : text.error); } finally { setSaving(false); }
  }
  return <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="auth-modal create-project-modal" role="dialog" aria-modal="true" aria-labelledby="create-organization-title">
      <button className="auth-modal__close" type="button" aria-label={text.close} onClick={onClose}><X size={19} strokeWidth={1.8} aria-hidden="true" /></button>
      {created ? <div className="auth-modal__success create-project-success"><CheckCircle2 size={32} strokeWidth={1.7} aria-hidden="true" /><strong>{text.success}</strong><span>{text.successDescription}</span><button className="auth-modal__primary" type="button" onClick={onClose}>{text.done}</button></div> : <><div className="auth-modal__heading create-project-modal__heading"><Building2 size={22} aria-hidden="true" /><h2 id="create-organization-title">{text.title}</h2></div><form className="auth-form create-project-form" onSubmit={submit}>
        <label className="auth-field"><span>{text.name}</span><span className="auth-input-wrap"><Building2 size={17} aria-hidden="true" /><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required autoFocus /></span></label>
        <label className="auth-field"><span>{text.slug}</span><span className="auth-input-wrap"><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} pattern="[a-z0-9][a-z0-9-]+" maxLength={80} required /></span><small>{text.slugHint}</small></label>
        <label className="auth-field"><span>{text.description}</span><span className="auth-input-wrap create-project-textarea-wrap"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} /></span></label>
        {error ? <p className="auth-form__error" role="alert">{error}</p> : null}<div className="create-project-form__actions"><button className="auth-code-button" type="button" onClick={onClose} disabled={saving}>{text.cancel}</button><button className="auth-modal__primary" type="submit" disabled={saving}><Plus size={17} aria-hidden="true" /><span>{text.submit}</span></button></div>
      </form></>}
    </section>
  </div>;
}
