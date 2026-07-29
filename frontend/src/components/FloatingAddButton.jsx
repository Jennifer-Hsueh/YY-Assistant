import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Floating circular button in the center of the screen (per the planning
// doc's decision for the 記帳 module's "new record" action).
export default function FloatingAddButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const options = [
    { label: '記一筆帳', icon: '💰', to: '/transactions?new=1' },
    { label: '新增行事曆', icon: '📅', to: '/calendar?new=1' },
  ];

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-8">
      {open && (
        <div className="mb-3 flex flex-col items-center gap-2">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setOpen(false);
                navigate(opt.to);
              }}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-md border border-gray-200"
            >
              <span>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-2xl text-white shadow-lg"
        aria-label="新增"
      >
        {open ? '×' : '+'}
      </button>
    </div>
  );
}
