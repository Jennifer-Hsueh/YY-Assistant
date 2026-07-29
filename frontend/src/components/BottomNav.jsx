import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: '首頁', icon: '🏠' },
  { to: '/transactions', label: '記帳', icon: '💰' },
  { to: '/calendar', label: '行事曆', icon: '📅' },
  { to: '/accounts', label: '帳戶', icon: '💳' },
  { to: '/recurring', label: '循環', icon: '🔁' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl justify-around">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`
              }
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}