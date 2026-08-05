'use client';

import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AuthModal, type AuthProvider } from '@/components/AuthModal';

type ExploreItem = {
  title: string;
  href: string;
};

const exploreItems: ExploreItem[] = [
  {
    title: '模组',
    href: '/mods'
  },
  {
    title: '主题包',
    href: '/mods?type=theme-pack'
  },
  {
    title: '整合包',
    href: '/modpacks'
  },
  {
    title: '服务器调整',
    href: '/mods?type=server'
  }
];

export function HomeShell() {
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(null);
  const [communityReady, setCommunityReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const exploreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!exploreRef.current?.contains(event.target as Node)) {
        setIsExploreOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsExploreOpen(false);
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('auth');
    const error = params.get('auth_error');
    if (auth === 'community') {
      setAuthProvider('community');
      setCommunityReady(true);
    }
    if (error) {
      setAuthProvider('community');
      setAuthError(error);
    }
    if (auth || error) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
  }, []);

  function openAuth(provider: AuthProvider) {
    setAuthProvider(provider);
    setCommunityReady(false);
    setAuthError('');
  }

  function closeAuth() {
    setAuthProvider(null);
    setCommunityReady(false);
    setAuthError('');
  }

  return (
    <div className={isNightMode ? 'site-shell site-shell--night' : 'site-shell'}>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand-lockup" href="/" aria-label="VSCN Mod DB 首页">
            <img
              src={isNightMode ? '/brand/logo-horizontal-night.svg' : '/brand/logo-horizontal-light-en.svg'}
              alt="VSCN Mod DB"
            />
          </a>

          <div className="site-header__actions">
            <button
              className="theme-toggle"
              type="button"
              title={isNightMode ? '切换日间模式' : '切换夜间模式'}
              aria-label={isNightMode ? '切换日间模式' : '切换夜间模式'}
              aria-pressed={isNightMode}
              onClick={() => setIsNightMode((night) => !night)}
            >
              {isNightMode ? <Sun size={18} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.8} aria-hidden="true" />}
            </button>

            <button
              className="mobile-menu-toggle"
              type="button"
              aria-label={isMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? <X size={19} strokeWidth={1.8} aria-hidden="true" /> : <Menu size={19} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          </div>

          <nav className={`site-nav${isMenuOpen ? ' site-nav--open' : ''}`} aria-label="主导航">
            <div
              className="explore-menu"
              ref={exploreRef}
              onMouseEnter={() => setIsExploreOpen(true)}
              onMouseLeave={() => setIsExploreOpen(false)}
              onFocusCapture={() => setIsExploreOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsExploreOpen(false);
                }
              }}
            >
              <button
                className="nav-button nav-button--explore"
                type="button"
                aria-expanded={isExploreOpen}
                aria-haspopup="menu"
                onClick={() =>
                  setIsExploreOpen((open) =>
                    window.matchMedia('(hover: hover)').matches ? true : !open
                  )
                }
              >
                <span>探索内容</span>
                <ChevronDown
                  className={isExploreOpen ? 'chevron-icon chevron-icon--up' : 'chevron-icon'}
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>

              {isExploreOpen ? (
                <div className="explore-popover" role="menu" aria-label="探索内容分类">
                  <div className="explore-list">
                    {exploreItems.map((item) => (
                      <a
                        className="explore-item"
                        href={item.href}
                        key={item.title}
                        role="menuitem"
                        onClick={() => {
                          setIsExploreOpen(false);
                          setIsMenuOpen(false);
                        }}
                      >
                        <span>{item.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <a className="nav-button nav-button--quiet" href="/submit" onClick={() => setIsMenuOpen(false)}>
              提交模组
            </a>
            <a
              className="nav-button nav-button--accent"
              href="https://vscn.studio/mod-translations"
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsMenuOpen(false)}
            >
              汉化计划
            </a>
          </nav>

        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__inner">
            <img
              className="hero__mark"
              src="/brand/logo-icon-rounded.svg"
              alt="复古物语中文社区图标"
            />

            <div className="hero__copy">
              <h1 id="hero-title">汇聚复古物语各类模组</h1>
              <p>在中文社区打造的网站平台上，探索并上传 VintageStory 的精彩创作</p>
            </div>

            <div className="auth-buttons" aria-label="登录入口">
              <button className="auth-button auth-button--community" type="button" onClick={() => openAuth('community')}>
                <img
                  className="auth-button__icon auth-button__icon--community"
                  src="/brand/logo-icon-rounded.svg"
                  alt=""
                />
                <span className="auth-button__label">社区登录</span>
              </button>
              <button className="auth-button auth-button--official" type="button" onClick={() => openAuth('official')}>
                <img
                  className="auth-button__icon auth-button__icon--official"
                  src="/brand/vintage-story-game-logo.png"
                  alt=""
                />
                <span className="auth-button__label">官方登录</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {authProvider ? (
        <AuthModal
          provider={authProvider}
          communityReady={communityReady}
          initialError={authError}
          onClose={closeAuth}
        />
      ) : null}
    </div>
  );
}
