'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { STRINGS, type StringKey } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: 'ur', setLang: () => {} });

export function useT() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang, t: (key: StringKey) => STRINGS[key][lang] };
}

export function Shell({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ur');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('beti-lang');
      if (saved === 'ur' || saved === 'en') setLangState(saved);
    } catch {}
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('beti-lang', next);
    } catch {}
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div
        dir={lang === 'ur' ? 'rtl' : 'ltr'}
        lang={lang}
        className={`w-full max-w-md mx-auto min-h-screen px-4 py-5 flex flex-col gap-5 ${lang === 'ur' ? 'font-urdu leading-loose' : 'font-sans'}`}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-slate-200"
          >
            {lang === 'ur' ? 'English' : 'اردو'}
          </button>
        </div>
        {children}
      </div>
    </LangContext.Provider>
  );
}
