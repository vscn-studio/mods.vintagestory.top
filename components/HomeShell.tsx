'use client';

import {
  Bell,
  Boxes,
  ChevronDown,
  Compass,
  FolderKanban,
  Heart,
  House,
  Languages,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Package,
  Palette,
  Settings,
  ServerCog,
  Sun,
  Upload,
  UserRound,
  UsersRound,
  X,
  type LucideIcon
} from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AuthModal, type AuthProvider, type SiteLanguage } from '@/components/AuthModal';
import { SiteLanguageContext } from '@/components/SiteLanguageContext';

const usePreferenceLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type ExploreItem = {
  zh: string;
  en: string;
  href: string;
  icon: LucideIcon;
};

const exploreItems: ExploreItem[] = [
  {
    zh: '模组',
    en: 'Mods',
    href: '/mods',
    icon: Package
  },
  {
    zh: '主题包',
    en: 'Theme Packs',
    href: '/mods?type=theme-pack',
    icon: Palette
  },
  {
    zh: '整合包',
    en: 'Modpacks',
    href: '/modpacks',
    icon: Boxes
  },
  {
    zh: '服务器调整',
    en: 'Server Tweaks',
    href: '/mods?type=server',
    icon: ServerCog
  }
];

const siteCopy = {
  'zh-CN': {
    pageTitle: 'VSCN Mod DB | 复古物语中文社区',
    pageDescription: '汇聚复古物语各类本地化模组的中文社区平台',
    brandHome: 'VSCN Mod DB 首页',
    brandAlt: 'VSCN Mod DB',
    login: '登录',
    dayMode: '切换日间模式',
    nightMode: '切换夜间模式',
    changeLanguage: '切换语言',
    chooseLanguage: '选择语言',
    simplifiedChinese: '简体中文',
    english: 'English',
    closeMobileMenu: '关闭导航菜单',
    openMobileMenu: '打开导航菜单',
    mainNavigation: '主导航',
    explore: '探索内容',
    exploreCategories: '探索内容分类',
    submit: '提交模组',
    translations: '汉化计划',
    heroIconAlt: '复古物语中文社区图标',
    heroTitle: '汇聚复古物语各类模组',
    heroDescription: '在中文社区打造的网站平台上，探索并上传 VintageStory 的精彩创作',
    authEntry: '登录入口',
    communityLogin: '社区登录',
    officialLogin: '官方登录',
    accountMenu: '账户菜单',
    avatarAlt: '玩家头像',
    personalHome: '个人首页',
    settings: '设置',
    notifications: '消息提醒',
    favorites: '模组收藏',
    projects: '个人项目',
    organizations: '组织管理',
    logout: '退出登录'
  },
  en: {
    pageTitle: 'VSCN Mod DB | Vintage Story Community',
    pageDescription: 'A community platform for discovering and sharing Vintage Story mods.',
    brandHome: 'VSCN Mod DB home',
    brandAlt: 'VSCN Mod DB',
    login: 'Sign in',
    dayMode: 'Switch to light mode',
    nightMode: 'Switch to dark mode',
    changeLanguage: 'Change language',
    chooseLanguage: 'Choose language',
    simplifiedChinese: '简体中文',
    english: 'English',
    closeMobileMenu: 'Close navigation menu',
    openMobileMenu: 'Open navigation menu',
    mainNavigation: 'Main navigation',
    explore: 'Explore content',
    exploreCategories: 'Explore content categories',
    submit: 'Submit a mod',
    translations: 'Translation project',
    heroIconAlt: 'Vintage Story Chinese community icon',
    heroTitle: 'A hub for Vintage Story mods',
    heroDescription: 'Explore and upload outstanding Vintage Story creations on a platform built by the Chinese community.',
    authEntry: 'Sign-in options',
    communityLogin: 'Community sign-in',
    officialLogin: 'Official sign-in',
    accountMenu: 'Account menu',
    avatarAlt: 'Player avatar',
    personalHome: 'Profile home',
    settings: 'Settings',
    notifications: 'Notifications',
    favorites: 'Favorite mods',
    projects: 'Personal projects',
    organizations: 'Organization management',
    logout: 'Sign out'
  }
} as const;

type HomeShellProps = {
  children?: ReactNode;
  initialLanguage?: SiteLanguage;
  initialNightMode?: boolean;
};

type SessionAccount = {
  displayName: string;
  provider: 'official' | 'community';
  avatarUrl?: string;
};

export function HomeShell({ children, initialLanguage = 'zh-CN', initialNightMode = false }: HomeShellProps) {
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNightMode, setIsNightMode] = useState(initialNightMode);
  const [language, setLanguage] = useState<SiteLanguage>(initialLanguage);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [sessionAccount, setSessionAccount] = useState<SessionAccount | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(null);
  const [communityReady, setCommunityReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const exploreRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!exploreRef.current?.contains(event.target as Node)) {
        setIsExploreOpen(false);
      }
      if (!languageRef.current?.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
      if (!accountRef.current?.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsExploreOpen(false);
        setIsLanguageOpen(false);
        setIsAccountOpen(false);
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

  async function refreshSession() {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) {
        setSessionAccount(null);
        return;
      }
      const payload = (await response.json()) as { account?: SessionAccount };
      setSessionAccount(payload.account ?? null);
    } catch {
      setSessionAccount(null);
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  usePreferenceLayoutEffect(() => {
    const hasLanguageCookie = document.cookie.split('; ').some((cookie) => cookie.startsWith('vscn-language='));
    const storedLanguage = window.localStorage.getItem('vscn-language');
    if (!hasLanguageCookie && (storedLanguage === 'en' || storedLanguage === 'zh-CN')) {
      document.cookie = `vscn-language=${storedLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setLanguage(storedLanguage);
    }
    const hasNightModeCookie = document.cookie.split('; ').some((cookie) => cookie.startsWith('vscn-night-mode='));
    const storedNightMode = window.localStorage.getItem('vscn-night-mode');
    if (!hasNightModeCookie && (storedNightMode === 'true' || storedNightMode === 'false')) {
      document.cookie = `vscn-night-mode=${storedNightMode}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setIsNightMode(storedNightMode === 'true');
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = siteCopy[language].pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', siteCopy[language].pageDescription);
  }, [language]);

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
    setIsLanguageOpen(false);
    setIsAccountOpen(false);
  }

  function switchAuthProvider(provider: AuthProvider) {
    setAuthProvider(provider);
    setCommunityReady(false);
    setAuthError('');
  }

  function closeAuth() {
    setAuthProvider(null);
    setCommunityReady(false);
    setAuthError('');
  }

  function toggleNightMode() {
    setIsNightMode((night) => {
      const next = !night;
      window.localStorage.setItem('vscn-night-mode', String(next));
      document.cookie = `vscn-night-mode=${String(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      return next;
    });
  }

  function changeLanguage(nextLanguage: SiteLanguage) {
    window.localStorage.setItem('vscn-language', nextLanguage);
    document.cookie = `vscn-language=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLanguage(nextLanguage);
    setIsLanguageOpen(false);
  }

  async function signOut() {
    setIsAccountOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSessionAccount(null);
  }

  const text = siteCopy[language];
  const pageContent = children;

  return (
    <SiteLanguageContext.Provider value={language}>
      <div className={isNightMode ? 'site-shell site-shell--night' : 'site-shell'}>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand-lockup" href="/" aria-label={text.brandHome}>
            <img
              src={isNightMode ? '/brand/logo-horizontal-night.svg' : '/brand/logo-horizontal-light-en.svg'}
              alt={text.brandAlt}
            />
          </a>

          <div className="site-header__actions">
            {sessionAccount ? (
              <a className="header-submit-button" href="/submit" title={text.submit} onClick={() => setIsMenuOpen(false)}>
                <Upload size={16} strokeWidth={1.9} aria-hidden="true" />
                <span className="header-submit-button__label">{text.submit}</span>
              </a>
            ) : null}

            <button
              className="theme-toggle"
              type="button"
              title={isNightMode ? text.dayMode : text.nightMode}
              aria-label={isNightMode ? text.dayMode : text.nightMode}
              aria-pressed={isNightMode}
              onClick={toggleNightMode}
            >
              {isNightMode ? <Sun size={18} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.8} aria-hidden="true" />}
            </button>

            <div
              className="language-menu"
              ref={languageRef}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsLanguageOpen(false);
                }
              }}
            >
              <button
                className="language-toggle"
                type="button"
                title={text.changeLanguage}
                aria-label={text.changeLanguage}
                aria-expanded={isLanguageOpen}
                aria-haspopup="menu"
                onClick={() => setIsLanguageOpen((open) => !open)}
              >
                <Languages size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>

              {isLanguageOpen ? (
                <div className="language-popover" role="menu" aria-label={text.chooseLanguage}>
                  <button
                    className={`language-item${language === 'zh-CN' ? ' language-item--active' : ''}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={language === 'zh-CN'}
                    onClick={() => changeLanguage('zh-CN')}
                  >
                    {text.simplifiedChinese}
                  </button>
                  <button
                    className={`language-item${language === 'en' ? ' language-item--active' : ''}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={language === 'en'}
                    onClick={() => changeLanguage('en')}
                  >
                    {text.english}
                  </button>
                </div>
              ) : null}
            </div>

            {sessionAccount ? (
              <div
                className="account-menu"
                ref={accountRef}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsAccountOpen(false);
                }}
              >
                <button
                  className="account-toggle"
                  type="button"
                  title={text.accountMenu}
                  aria-label={text.accountMenu}
                  aria-expanded={isAccountOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsAccountOpen((open) => !open)}
                >
                  <span className="account-avatar" aria-hidden="true">
                    {sessionAccount.avatarUrl ? (
                      <img src={sessionAccount.avatarUrl} alt="" />
                    ) : (
                      <UserRound size={18} strokeWidth={1.8} />
                    )}
                  </span>
                  <span className="account-toggle__name">{sessionAccount.displayName}</span>
                  <ChevronDown className={isAccountOpen ? 'account-toggle__chevron account-toggle__chevron--up' : 'account-toggle__chevron'} size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>

                {isAccountOpen ? (
                  <div className="account-popover" role="menu" aria-label={text.accountMenu}>
                    <button className="account-menu__item" type="button" role="menuitem">
                      <House size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{text.personalHome}</span>
                    </button>
                    <button className="account-menu__item" type="button" role="menuitem">
                      <Settings size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{text.settings}</span>
                    </button>
                    <button className="account-menu__item" type="button" role="menuitem">
                      <Bell size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{text.notifications}</span>
                    </button>
                    <button className="account-menu__item" type="button" role="menuitem">
                      <Heart size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{text.favorites}</span>
                    </button>
                    <button className="account-menu__item" type="button" role="menuitem">
                      <FolderKanban size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{text.projects}</span>
                    </button>
                    <button className="account-menu__item" type="button" role="menuitem">
                      <UsersRound size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{text.organizations}</span>
                    </button>
                    <button className="account-menu__item account-menu__item--danger" type="button" role="menuitem" onClick={signOut}>
                      <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{text.logout}</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                className="header-login-button"
                type="button"
                onClick={() => openAuth('community')}
              >
                <LogIn size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>{text.login}</span>
              </button>
            )}

            <button
              className="mobile-menu-toggle"
              type="button"
              aria-label={isMenuOpen ? text.closeMobileMenu : text.openMobileMenu}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? <X size={19} strokeWidth={1.8} aria-hidden="true" /> : <Menu size={19} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          </div>

          <nav className={`site-nav${isMenuOpen ? ' site-nav--open' : ''}`} aria-label={text.mainNavigation}>
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
                <Compass size={19} strokeWidth={2} aria-hidden="true" />
                <span>{text.explore}</span>
                <ChevronDown
                  className={isExploreOpen ? 'chevron-icon chevron-icon--up' : 'chevron-icon'}
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>

              {isExploreOpen ? (
                <div className="explore-popover" role="menu" aria-label={text.exploreCategories}>
                  <div className="explore-list">
                    {exploreItems.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <a
                          className="explore-item"
                          href={item.href}
                          key={item.href}
                          role="menuitem"
                          onClick={() => {
                            setIsExploreOpen(false);
                            setIsMenuOpen(false);
                          }}
                        >
                          <ItemIcon size={18} strokeWidth={2} aria-hidden="true" />
                          <span>{language === 'en' ? item.en : item.zh}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <a
              className="nav-button nav-button--accent"
              href="https://vscn.studio/mod-translations"
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsMenuOpen(false)}
            >
              <Languages size={19} strokeWidth={2} aria-hidden="true" />
              {text.translations}
            </a>
          </nav>

        </div>
      </header>

      <main>
        {pageContent ?? (
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero__inner">
              <img
                className="hero__mark"
                src="/brand/logo-icon-rounded.svg"
                alt={text.heroIconAlt}
              />

              <div className="hero__copy">
                <h1 id="hero-title">{text.heroTitle}</h1>
                <p>{text.heroDescription}</p>
              </div>

              <div className="auth-buttons" aria-label={text.authEntry}>
                <button className="auth-button auth-button--community" type="button" onClick={() => openAuth('community')}>
                  <img
                    className="auth-button__icon auth-button__icon--community"
                    src="/brand/logo-icon-rounded.svg"
                    alt=""
                  />
                  <span className="auth-button__label">{text.communityLogin}</span>
                </button>
                <button className="auth-button auth-button--official" type="button" onClick={() => openAuth('official')}>
                  <img
                    className="auth-button__icon auth-button__icon--official"
                    src="/brand/vintage-story-game-logo.png"
                    alt=""
                  />
                  <span className="auth-button__label">{text.officialLogin}</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {authProvider ? (
        <AuthModal
          provider={authProvider}
          communityReady={communityReady}
          initialError={authError}
          language={language}
          onAuthenticated={() => void refreshSession()}
          onProviderChange={switchAuthProvider}
          onClose={closeAuth}
        />
      ) : null}
      </div>
    </SiteLanguageContext.Provider>
  );
}
