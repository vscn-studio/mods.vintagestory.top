'use client';

import { KeyRound, LoaderCircle, Mail, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type { SiteLanguage } from '@/lib/site-language';

export type AuthProvider = 'official' | 'community';
export type { SiteLanguage } from '@/lib/site-language';

type OfficialIdentity = {
  displayName: string;
  playerUid: string;
};

type AuthModalProps = {
  provider: AuthProvider;
  communityReady?: boolean;
  initialError?: string;
  language: SiteLanguage;
  onAuthenticated: () => void;
  onProviderChange: (provider: AuthProvider) => void;
  onClose: () => void;
};

const modalCopy = {
  'zh-CN': {
    close: '关闭登录窗口',
    tabs: '登录方式',
    communityTab: '社区登录',
    officialTab: '游戏登录',
    officialTitle: '官方账号绑定',
    communityTitle: '社区账号绑定',
    description: 'Mod 站账号与社区账号、游戏账号分开管理。',
    completeTitle: '绑定完成',
    completePrefix: '以后可使用已绑定的',
    completeSuffix: '进入 Mod 站。',
    complete: '完成',
    verifiedPrefix: '已认证：',
    communityAccount: '社区账号',
    bindEmail: '绑定邮箱',
    bindEmailPlaceholder: '用于接收验证码',
    sending: '发送中…',
    resend: '重新发送',
    sendCode: '发送验证码',
    emailCode: '邮箱验证码',
    emailCodePlaceholder: '输入邮箱中的 6 位验证码',
    bindingHint: '验证码有效期 10 分钟。邮箱只用于绑定 Mod 站账号，不能直接用邮箱注册或登录。',
    binding: '绑定中…',
    registerAndBind: '注册并绑定',
    communityAuthTitle: '使用社区账号认证',
    communityAuthDescription: '通过 VintageStory Connect 授权后，再填写绑定邮箱并验证邮箱验证码。',
    authorizeCommunity: '前往社区授权',
    gameAccount: '游戏账号',
    gameAccountPlaceholder: 'VintageStory 账号邮箱',
    gamePassword: '游戏密码',
    gamePasswordPlaceholder: 'VintageStory 账号密码',
    totp: '二步验证码',
    totpPlaceholder: '输入 6 位验证码',
    verifying: '验证中…',
    verifyOfficial: '验证官方账号',
    officialProvider: 'VintageStory 官方账号',
    communityProvider: 'Discourse 社区账号',
    officialAuthFailed: '官方认证失败，请重试。',
    bindingFailed: '绑定失败，请重试。',
    activationRequired: '请先向绑定邮箱发送验证码。',
    emailRequired: '请先输入绑定邮箱。',
    activationFailed: '验证码发送失败，请重试。'
  },
  en: {
    close: 'Close sign-in dialog',
    tabs: 'Sign-in method',
    communityTab: 'Community sign-in',
    officialTab: 'Game sign-in',
    officialTitle: 'Bind official account',
    communityTitle: 'Bind community account',
    description: 'Your Mod DB account is separate from your community and game accounts.',
    completeTitle: 'Binding complete',
    completePrefix: 'You can now use the linked',
    completeSuffix: 'to enter Mod DB.',
    complete: 'Done',
    verifiedPrefix: 'Verified: ',
    communityAccount: 'Community account',
    bindEmail: 'Binding email',
    bindEmailPlaceholder: 'Used to receive the verification code',
    sending: 'Sending…',
    resend: 'Send again',
    sendCode: 'Send code',
    emailCode: 'Email verification code',
    emailCodePlaceholder: 'Enter the 6-digit code from your email',
    bindingHint: 'The code expires in 10 minutes. Email is only used to bind your Mod DB account; it cannot be used to sign up or sign in directly.',
    binding: 'Binding…',
    registerAndBind: 'Register and bind',
    communityAuthTitle: 'Authenticate with your community account',
    communityAuthDescription: 'Authorize through VintageStory Connect, then enter a binding email and verify its code.',
    authorizeCommunity: 'Authorize with community',
    gameAccount: 'Game account',
    gameAccountPlaceholder: 'VintageStory account email',
    gamePassword: 'Game password',
    gamePasswordPlaceholder: 'VintageStory account password',
    totp: 'Two-step verification code',
    totpPlaceholder: 'Enter the 6-digit code',
    verifying: 'Verifying…',
    verifyOfficial: 'Verify official account',
    officialProvider: 'VintageStory official account',
    communityProvider: 'Discourse community account',
    officialAuthFailed: 'Official authentication failed. Please try again.',
    bindingFailed: 'Binding failed. Please try again.',
    activationRequired: 'Send a verification code to the binding email first.',
    emailRequired: 'Enter a binding email first.',
    activationFailed: 'The verification code could not be sent. Please try again.'
  }
} as const;

export function AuthModal({
  provider,
  communityReady = false,
  initialError = '',
  language,
  onAuthenticated,
  onProviderChange,
  onClose
}: AuthModalProps) {
  const [officialStage, setOfficialStage] = useState<'verify' | 'bind' | 'success'>('verify');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [preLoginToken, setPreLoginToken] = useState('');
  const [identity, setIdentity] = useState<OfficialIdentity | null>(null);
  const [bindEmail, setBindEmail] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [bindComplete, setBindComplete] = useState(false);

  const isBinding = provider === 'community' ? communityReady : officialStage === 'bind';
  const isSuccess = bindComplete;
  const activationReady = Boolean(sentEmail && sentEmail === bindEmail.trim().toLowerCase());
  const text = modalCopy[language];

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    setOfficialStage('verify');
    setIdentity(null);
    setBindEmail('');
    setActivationCode('');
    setSentEmail('');
    setCooldownSeconds(0);
    setError(initialError);
    setBindComplete(false);
  }, [provider, initialError]);

  const parseError = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as { message?: string; code?: string; preLoginToken?: string };
      return payload;
    } catch {
      return { message: fallback };
    }
  };

  async function verifyOfficial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password, totpCode, preLoginToken })
      });
      if (!response.ok) {
        const payload = await parseError(response, text.officialAuthFailed);
        if (payload.code === 'VS_TOTP_REQUIRED') {
          setPreLoginToken(payload.preLoginToken ?? '');
        }
        throw new Error(payload.message ?? text.officialAuthFailed);
      }
      const payload = (await response.json()) as { identity: OfficialIdentity };
      setIdentity(payload.identity);
      setOfficialStage('bind');
      setPassword('');
      setTotpCode('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.officialAuthFailed);
    } finally {
      setBusy(false);
    }
  }

  async function bindAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!activationReady) {
      setError(text.activationRequired);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindEmail, activationCode })
      });
      if (!response.ok) {
        const payload = await parseError(response, text.bindingFailed);
        throw new Error(payload.message ?? text.bindingFailed);
      }
      setOfficialStage('success');
      setBindComplete(true);
      onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.bindingFailed);
    } finally {
      setBusy(false);
    }
  }

  async function requestActivationCode() {
    if (busy || sendBusy || cooldownSeconds > 0) return;
    const normalizedEmail = bindEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(text.emailRequired);
      return;
    }
    setSendBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/activation/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindEmail: normalizedEmail })
      });
      if (!response.ok) {
        const payload = await parseError(response, text.activationFailed);
        throw new Error(payload.message ?? text.activationFailed);
      }
      const payload = (await response.json()) as { retryAfterSeconds?: number };
      setSentEmail(normalizedEmail);
      setActivationCode('');
      setCooldownSeconds(payload.retryAfterSeconds ?? 60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.activationFailed);
    } finally {
      setSendBusy(false);
    }
  }

  function startCommunityAuth() {
    window.location.assign('/api/auth/community/login?returnTo=/');
  }

  const title = provider === 'official' ? text.officialTitle : text.communityTitle;
  const providerLabel = provider === 'official' ? text.officialProvider : text.communityProvider;

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="auth-modal__close" type="button" aria-label={text.close} onClick={onClose}>
          <X size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div className="auth-modal__tabs" role="tablist" aria-label={text.tabs}>
          <button
            className={provider === 'community' ? 'auth-modal__tab auth-modal__tab--active' : 'auth-modal__tab'}
            type="button"
            role="tab"
            aria-selected={provider === 'community'}
            onClick={() => onProviderChange('community')}
          >
            {text.communityTab}
          </button>
          <button
            className={provider === 'official' ? 'auth-modal__tab auth-modal__tab--active' : 'auth-modal__tab'}
            type="button"
            role="tab"
            aria-selected={provider === 'official'}
            onClick={() => onProviderChange('official')}
          >
            {text.officialTab}
          </button>
        </div>

        <div className="auth-modal__heading">
          <span className="auth-modal__eyebrow">MOD DB ACCOUNT</span>
          <h2 id="auth-modal-title">{title}</h2>
          <p>{text.description}</p>
        </div>

        {isSuccess ? (
          <div className="auth-modal__success">
            <ShieldCheck size={30} strokeWidth={1.7} aria-hidden="true" />
            <strong>{text.completeTitle}</strong>
            <span>{text.completePrefix} {providerLabel} {text.completeSuffix}</span>
            <button className="auth-modal__primary" type="button" onClick={onClose}>
              {text.complete}
            </button>
          </div>
        ) : isBinding ? (
          <form className="auth-form" onSubmit={bindAccount}>
            <div className="auth-provider-chip">
              <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{text.verifiedPrefix}{provider === 'official' ? identity?.displayName : text.communityAccount}</span>
            </div>
            <div className="auth-field">
              <span>{text.bindEmail}</span>
              <div className="auth-field__row">
                <label className="auth-input-wrap auth-input-wrap--grow">
                  <Mail size={17} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    type="email"
                    value={bindEmail}
                    onChange={(event) => setBindEmail(event.target.value)}
                    placeholder={text.bindEmailPlaceholder}
                    autoComplete="email"
                    aria-label={text.bindEmail}
                    required
                  />
                </label>
                <button
                  className="auth-code-button"
                  type="button"
                  onClick={requestActivationCode}
                  disabled={sendBusy || busy || cooldownSeconds > 0}
                >
                  {sendBusy ? text.sending : cooldownSeconds > 0 ? `${cooldownSeconds}s` : sentEmail ? text.resend : text.sendCode}
                </button>
              </div>
            </div>
            <label className="auth-field">
              <span>{text.emailCode}</span>
              <span className="auth-input-wrap">
                <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="text"
                  value={activationCode}
                  onChange={(event) => setActivationCode(event.target.value)}
                  placeholder={text.emailCodePlaceholder}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={!activationReady}
                  required
                />
              </span>
            </label>
            <p className="auth-form__hint">{text.bindingHint}</p>
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" /> : null}
              {busy ? text.binding : text.registerAndBind}
            </button>
          </form>
        ) : provider === 'community' ? (
          <div className="auth-modal__intro">
            <div className="auth-modal__provider-icon auth-modal__provider-icon--community">
              <svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="100" y="233" width="200" height="200" rx="12" fill="#6b8e23" />
                <rect x="500" y="233" width="200" height="200" rx="12" fill="#8b5a2b" />
                <rect x="300" y="433" width="200" height="200" rx="12" fill="#555" />
              </svg>
            </div>
            <strong>{text.communityAuthTitle}</strong>
            <span>{text.communityAuthDescription}</span>
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="button" onClick={startCommunityAuth}>
              {text.authorizeCommunity}
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={verifyOfficial}>
            <label className="auth-field">
              <span>{text.gameAccount}</span>
              <span className="auth-input-wrap">
                <Mail size={17} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="email"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder={text.gameAccountPlaceholder}
                  autoComplete="username"
                  required
                />
              </span>
            </label>
            <label className="auth-field">
              <span>{text.gamePassword}</span>
              <span className="auth-input-wrap">
                <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={text.gamePasswordPlaceholder}
                  autoComplete="current-password"
                  required
                />
              </span>
            </label>
            {preLoginToken ? (
              <label className="auth-field">
                <span>{text.totp}</span>
                <span className="auth-input-wrap">
                  <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value)}
                    placeholder={text.totpPlaceholder}
                    autoComplete="one-time-code"
                    required
                  />
                </span>
              </label>
            ) : null}
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" /> : null}
              {busy ? text.verifying : text.verifyOfficial}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
