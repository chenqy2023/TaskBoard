import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import en from './locales/en';

export const LOCALE_KEY = 'taskboard-locale';
export type AppLocale = 'zh-CN' | 'en';

export const SUPPORTED_LOCALES: { value: AppLocale; labelKey: string }[] = [
  { value: 'zh-CN', labelKey: 'locale.zhCN' },
  { value: 'en', labelKey: 'locale.en' },
];

export function detectLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === 'en' || saved === 'zh-CN') return saved;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    en,
  },
});

/** 由 router 注册：语言切换后按当前路由刷新 document.title */
let refreshDocumentTitle: (() => void) | null = null;

export function registerDocumentTitleRefresh(fn: () => void) {
  refreshDocumentTitle = fn;
}

export function setAppLocale(locale: AppLocale) {
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en';
  }
  refreshDocumentTitle?.();
}

export function tGlobal(key: string, params?: Record<string, unknown>) {
  // vue-i18n 11：命名插值必须用 t(key, named)，勿把 locale 放在第二参
  if (params) {
    return i18n.global.t(key, params as never) as string;
  }
  return i18n.global.t(key) as string;
}

/** 启动时同步 <html lang> */
setAppLocale(detectLocale());
