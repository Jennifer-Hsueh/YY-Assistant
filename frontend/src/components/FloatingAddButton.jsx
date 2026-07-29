import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Wallet, Calendar } from 'lucide-react';
import { Button } from './ui/button';

export default function FloatingAddButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const options = [
    { label: '記一筆帳', Icon: Wallet, to: '/transactions?new=1' },
    { label: '新增行事曆', Icon: Calendar, to: '/calendar?new=1' },
  ];

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-8">
      {open && (
        <div className="mb-3 flex flex-col items-center gap-2">
          {options.map(({ label, Icon, to }) => (
            <Button key={label} variant="secondary" onClick={() => { setOpen(false); navigate(to); }} className="gap-2 rounded-full shadow-md">
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      )}
      <Button size="icon" onClick={() => setOpen((v) => !v)} className="h-14 w-14 rounded-full shadow-lg" aria-label="新增">
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
    </div>
  );
}
