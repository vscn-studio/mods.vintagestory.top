'use client';

import { KeyRound, LoaderCircle, Mail, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type { SiteLanguage } from '@/lib/site-language';
import { ensureCsrfToken } from '@/lib/client-confirmation';

export type AuthProvider = 'official' | 'community' | 'email';
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
    emailTab: '邮箱登录',
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
    bindingHint: '验证码有效期 10 分钟。验证邮箱后设置 Mod 站密码，之后可使用邮箱登录。',
    binding: '绑定中…',
    verifyBindingCode: '验证邮箱',
    setPassword: '设置密码并完成绑定',
    bindPassword: '登录密码',
    bindPasswordPlaceholder: '设置 8 至 128 个字符的密码',
    confirmPassword: '确认密码',
    confirmPasswordPlaceholder: '再次输入登录密码',
    communityAuthTitle: '使用社区账号认证',
    communityAuthDescription: '首次使用需要绑定邮箱并验证验证码，之后可直接使用社区账号登录。',
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
    emailTitle: '邮箱登录',
    emailDescription: '使用已绑定身份的邮箱登录，邮箱不能单独注册。',
    emailLogin: '邮箱登录',
    emailPlaceholder: '已绑定的邮箱',
    emailPassword: 'Mod 站密码',
    emailPasswordPlaceholder: '输入 Mod 站密码',
    emailLoginFailed: '邮箱或密码错误，请检查后重试。',
    passwordTooShort: '密码长度需为 8 至 128 个字符。',
    passwordMismatch: '两次输入的密码不一致。',
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
    emailTab: 'Email sign-in',
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
    bindingHint: 'The code expires in 10 minutes. Set a Mod DB password after verification, then use this email to sign in.',
    binding: 'Binding…',
    verifyBindingCode: 'Verify email',
    setPassword: 'Set password and finish',
    bindPassword: 'Sign-in password',
    bindPasswordPlaceholder: 'Choose an 8–128 character password',
    confirmPassword: 'Confirm password',
    confirmPasswordPlaceholder: 'Enter the password again',
    communityAuthTitle: 'Authenticate with your community account',
    communityAuthDescription: 'The first use binds an email with a verification code. Later sign-ins use the community account directly.',
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
    emailTitle: 'Email sign-in',
    emailDescription: 'Sign in with a linked email. Email-only registration is unavailable.',
    emailLogin: 'Sign in with email',
    emailPlaceholder: 'Linked email address',
    emailPassword: 'Mod DB password',
    emailPasswordPlaceholder: 'Enter your Mod DB password',
    emailLoginFailed: 'Email or password is incorrect. Please check and try again.',
    passwordTooShort: 'Password must be 8 to 128 characters.',
    passwordMismatch: 'The passwords do not match.',
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
  const [activationVerified, setActivationVerified] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [bindPassword, setBindPassword] = useState('');
  const [bindConfirmPassword, setBindConfirmPassword] = useState('');
  const [emailLogin, setEmailLogin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [bindComplete, setBindComplete] = useState(false);

  const isBinding = provider === 'community' ? communityReady : provider === 'official' ? officialStage === 'bind' : false;
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
    setActivationVerified(false);
    setBindPassword('');
    setBindConfirmPassword('');
    setEmailLogin('');
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

  async function csrfHeaders(): Promise<Record<string, string>> {
    const token = await ensureCsrfToken();
    return token ? { 'x-csrf-token': decodeURIComponent(token) } : {};
  }

  async function verifyOfficial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
        body: JSON.stringify({ account, password, totpCode, preLoginToken })
      });
      if (!response.ok) {
        const payload = await parseError(response, text.officialAuthFailed);
        if (payload.code === 'VS_TOTP_REQUIRED') {
          setPreLoginToken(payload.preLoginToken ?? '');
        }
        throw new Error(payload.message ?? text.officialAuthFailed);
      }
      const payload = (await response.json()) as { identity: OfficialIdentity; authenticated?: boolean };
      if (payload.authenticated) {
        onAuthenticated();
        onClose();
        return;
      }
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
    if (!activationVerified && !activationReady) {
      setError(text.activationRequired);
      return;
    }
    if (activationVerified && (bindPassword.length < 8 || bindPassword.length > 128)) {
      setError(text.passwordTooShort);
      return;
    }
    if (activationVerified && bindPassword !== bindConfirmPassword) {
      setError(text.passwordMismatch);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
        body: activationVerified
          ? JSON.stringify({ step: 'set-password', bindEmail, password: bindPassword, confirmPassword: bindConfirmPassword })
          : JSON.stringify({ step: 'verify-code', bindEmail, activationCode })
      });
      if (!response.ok) {
        const payload = await parseError(response, text.bindingFailed);
        throw new Error(payload.message ?? text.bindingFailed);
      }
      if (!activationVerified) {
        setActivationVerified(true);
        setError('');
      } else {
        setOfficialStage('success');
        setBindComplete(true);
        onAuthenticated();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.bindingFailed);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
        body: JSON.stringify({ email: emailLogin, password })
      });
      if (!response.ok) {
        throw new Error(text.emailLoginFailed);
      }
      onAuthenticated();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.emailLoginFailed);
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
        headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
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
          <button
            className={provider === 'email' ? 'auth-modal__tab auth-modal__tab--active' : 'auth-modal__tab'}
            type="button"
            role="tab"
            aria-selected={provider === 'email'}
            onClick={() => onProviderChange('email')}
          >
            {text.emailTab}
          </button>
        </div>

        <div className="auth-modal__heading">
          <span className="auth-modal__eyebrow">MOD DB ACCOUNT</span>
          <h2 id="auth-modal-title">{provider === 'email' ? text.emailTitle : title}</h2>
          <p>{provider === 'email' ? text.emailDescription : text.description}</p>
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
                    onChange={(event) => {
                      setBindEmail(event.target.value);
                      setActivationVerified(false);
                    }}
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
                  disabled={sendBusy || busy || cooldownSeconds > 0 || activationVerified}
                >
                  {sendBusy ? text.sending : cooldownSeconds > 0 ? `${cooldownSeconds}s` : sentEmail ? text.resend : text.sendCode}
                </button>
              </div>
            </div>
            {!activationVerified ? <label className="auth-field">
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
            </label> : <>
              <label className="auth-field">
                <span>{text.bindPassword}</span>
                <span className="auth-input-wrap">
                  <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                  <input type="password" value={bindPassword} onChange={(event) => setBindPassword(event.target.value)} placeholder={text.bindPasswordPlaceholder} autoComplete="new-password" required />
                </span>
              </label>
              <label className="auth-field">
                <span>{text.confirmPassword}</span>
                <span className="auth-input-wrap">
                  <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                  <input type="password" value={bindConfirmPassword} onChange={(event) => setBindConfirmPassword(event.target.value)} placeholder={text.confirmPasswordPlaceholder} autoComplete="new-password" required />
                </span>
              </label>
            </>}
            <p className="auth-form__hint">{text.bindingHint}</p>
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" /> : null}
              {busy ? text.binding : activationVerified ? text.setPassword : text.verifyBindingCode}
            </button>
          </form>
        ) : provider === 'email' ? (
          <form className="auth-form" onSubmit={signInWithEmail}>
            <label className="auth-field">
              <span>{text.bindEmail}</span>
              <span className="auth-input-wrap">
                <Mail size={17} strokeWidth={1.8} aria-hidden="true" />
                <input type="email" value={emailLogin} onChange={(event) => setEmailLogin(event.target.value)} placeholder={text.emailPlaceholder} autoComplete="email" required />
              </span>
            </label>
            <label className="auth-field">
              <span>{text.emailPassword}</span>
              <span className="auth-input-wrap">
                <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.emailPasswordPlaceholder} autoComplete="current-password" required />
              </span>
            </label>
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" /> : null}
              {busy ? text.verifying : text.emailLogin}
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
