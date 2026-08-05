'use client';

import { KeyRound, LoaderCircle, Mail, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

export type AuthProvider = 'official' | 'community';

type OfficialIdentity = {
  displayName: string;
  playerUid: string;
};

type AuthModalProps = {
  provider: AuthProvider;
  communityReady?: boolean;
  initialError?: string;
  onClose: () => void;
};

export function AuthModal({ provider, communityReady = false, initialError = '', onClose }: AuthModalProps) {
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

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

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
        const payload = await parseError(response, '官方认证失败，请重试。');
        if (payload.code === 'VS_TOTP_REQUIRED') {
          setPreLoginToken(payload.preLoginToken ?? '');
        }
        throw new Error(payload.message ?? '官方认证失败，请重试。');
      }
      const payload = (await response.json()) as { identity: OfficialIdentity };
      setIdentity(payload.identity);
      setOfficialStage('bind');
      setPassword('');
      setTotpCode('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '官方认证失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function bindAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!activationReady) {
      setError('请先向绑定邮箱发送验证码。');
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
        const payload = await parseError(response, '绑定失败，请重试。');
        throw new Error(payload.message ?? '绑定失败，请重试。');
      }
      setOfficialStage('success');
      setBindComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '绑定失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function requestActivationCode() {
    if (busy || sendBusy || cooldownSeconds > 0) return;
    const normalizedEmail = bindEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('请先输入绑定邮箱。');
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
        const payload = await parseError(response, '验证码发送失败，请重试。');
        throw new Error(payload.message ?? '验证码发送失败，请重试。');
      }
      const payload = (await response.json()) as { retryAfterSeconds?: number };
      setSentEmail(normalizedEmail);
      setActivationCode('');
      setCooldownSeconds(payload.retryAfterSeconds ?? 60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败，请重试。');
    } finally {
      setSendBusy(false);
    }
  }

  function startCommunityAuth() {
    window.location.assign('/api/auth/community/login?returnTo=/');
  }

  const title = provider === 'official' ? '官方账号绑定' : '社区账号绑定';
  const providerLabel = provider === 'official' ? 'VintageStory 官方账号' : 'Discourse 社区账号';

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="auth-modal__close" type="button" aria-label="关闭登录窗口" onClick={onClose}>
          <X size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div className="auth-modal__heading">
          <span className="auth-modal__eyebrow">MOD DB ACCOUNT</span>
          <h2 id="auth-modal-title">{title}</h2>
          <p>Mod 站账号与社区账号、游戏账号分开管理。</p>
        </div>

        {isSuccess ? (
          <div className="auth-modal__success">
            <ShieldCheck size={30} strokeWidth={1.7} aria-hidden="true" />
            <strong>绑定完成</strong>
            <span>以后可使用已绑定的 {providerLabel} 进入 Mod 站。</span>
            <button className="auth-modal__primary" type="button" onClick={onClose}>
              完成
            </button>
          </div>
        ) : isBinding ? (
          <form className="auth-form" onSubmit={bindAccount}>
            <div className="auth-provider-chip">
              <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>已认证：{provider === 'official' ? identity?.displayName : '社区账号'}</span>
            </div>
            <div className="auth-field">
              <span>绑定邮箱</span>
              <div className="auth-field__row">
                <label className="auth-input-wrap auth-input-wrap--grow">
                  <Mail size={17} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    type="email"
                    value={bindEmail}
                    onChange={(event) => setBindEmail(event.target.value)}
                    placeholder="用于接收验证码"
                    autoComplete="email"
                    aria-label="绑定邮箱"
                    required
                  />
                </label>
                <button
                  className="auth-code-button"
                  type="button"
                  onClick={requestActivationCode}
                  disabled={sendBusy || busy || cooldownSeconds > 0}
                >
                  {sendBusy ? '发送中…' : cooldownSeconds > 0 ? `${cooldownSeconds}s` : sentEmail ? '重新发送' : '发送验证码'}
                </button>
              </div>
            </div>
            <label className="auth-field">
              <span>邮箱验证码</span>
              <span className="auth-input-wrap">
                <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="text"
                  value={activationCode}
                  onChange={(event) => setActivationCode(event.target.value)}
                  placeholder="输入邮箱中的 6 位验证码"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={!activationReady}
                  required
                />
              </span>
            </label>
            <p className="auth-form__hint">验证码有效期 10 分钟。邮箱只用于绑定 Mod 站账号，不能直接用邮箱注册或登录。</p>
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" /> : null}
              {busy ? '绑定中…' : '注册并绑定'}
            </button>
          </form>
        ) : provider === 'community' ? (
          <div className="auth-modal__intro">
            <div className="auth-modal__provider-icon auth-modal__provider-icon--community">
              <ShieldCheck size={26} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <strong>使用社区账号认证</strong>
            <span>通过 VintageStory Connect 授权后，再填写绑定邮箱并验证邮箱验证码。</span>
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="button" onClick={startCommunityAuth}>
              前往社区授权
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={verifyOfficial}>
            <div className="auth-modal__provider-note">先验证 VintageStory 官方账号，再绑定 Mod 站账号。</div>
            <label className="auth-field">
              <span>游戏账号</span>
              <span className="auth-input-wrap">
                <Mail size={17} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="email"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="VintageStory 账号邮箱"
                  autoComplete="username"
                  required
                />
              </span>
            </label>
            <label className="auth-field">
              <span>游戏密码</span>
              <span className="auth-input-wrap">
                <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="VintageStory 账号密码"
                  autoComplete="current-password"
                  required
                />
              </span>
            </label>
            {preLoginToken ? (
              <label className="auth-field">
                <span>二步验证码</span>
                <span className="auth-input-wrap">
                  <KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value)}
                    placeholder="输入 6 位验证码"
                    autoComplete="one-time-code"
                    required
                  />
                </span>
              </label>
            ) : null}
            {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
            <button className="auth-modal__primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" /> : null}
              {busy ? '验证中…' : '验证官方账号'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
