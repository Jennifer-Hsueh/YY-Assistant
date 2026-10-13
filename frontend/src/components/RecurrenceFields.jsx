import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Input } from './ui/input';

// 循環頻率欄位:每月(1–31、最後一天)/ 每週(星期幾)/ 每年(日期)
export default function RecurrenceFields({ form, setForm, t }) {
  const set = (patch) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{t('rec_frequency')}</label>
      <div className="flex gap-2">
        <Select value={form.frequency} onValueChange={(v) => set({ frequency: v })}>
          <SelectTrigger className="w-24 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">{t('rec_freq_monthly')}</SelectItem>
            <SelectItem value="weekly">{t('rec_freq_weekly')}</SelectItem>
            <SelectItem value="yearly">{t('rec_freq_yearly')}</SelectItem>
          </SelectContent>
        </Select>
        {form.frequency === 'monthly' && (
          <Select value={String(form.day_of_month)} onValueChange={(v) => set({ day_of_month: v })}>
            <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                <SelectItem key={d} value={d}>{t('rec_day_prefix')}{d}{t('rec_day_suffix')}</SelectItem>
              ))}
              <SelectItem value="-1">{t('rec_last_day_short')}</SelectItem>
            </SelectContent>
          </Select>
        )}
        {form.frequency === 'weekly' && (
          <Select value={String(form.day_of_week)} onValueChange={(v) => set({ day_of_week: v })}>
            <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {t('cal_weekdays').map((w, i) => (
                <SelectItem key={i} value={String(i)}>{t('rec_weekly_prefix')}{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {form.frequency === 'yearly' && (
          <Input type="date" required value={form.yearly_date} onChange={(e) => set({ yearly_date: e.target.value })} className="min-w-0 flex-1" />
        )}
      </div>
    </div>
  );
}
