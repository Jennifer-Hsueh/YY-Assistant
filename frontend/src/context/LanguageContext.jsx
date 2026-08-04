import { createContext, useContext, useState, useEffect } from 'react';

const dictionary = {
  zh: {
    appName: 'YY 手帳',
    logout: '登出',
    overview: '概覽',
    nav_home: '首頁',
    nav_transactions: '記帳',
    nav_calendar: '行事曆',
    nav_accounts: '帳戶',
    nav_recurring: '循環',
    month_expense: '本月支出',
    month_income: '本月收入',
    total_balance: '總餘額',
    today_events: '今日行程',
    no_events_today: '今天沒有安排的行程',
    loading: '載入中…',
  },
  en: {
    appName: 'YY Journal',
    logout: 'Logout',
    overview: 'Overview',
    nav_home: 'Home',
    nav_transactions: 'Ledger',
    nav_calendar: 'Calendar',
    nav_accounts: 'Accounts',
    nav_recurring: 'Recurring',
    month_expense: 'This Month Spending',
    month_income: 'This Month Income',
    total_balance: 'Total Balance',
    today_events: "Today's Events",
    no_events_today: 'No events scheduled today',
    loading: 'Loading…',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'zh');

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  function toggleLanguage() {
    setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'));
  }

  function t(key) {
    return dictionary[language]?.[key] ?? dictionary.zh[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
