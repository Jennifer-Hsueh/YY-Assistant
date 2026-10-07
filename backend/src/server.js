require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const accountRoutes = require('./routes/accountRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const eventRoutes = require('./routes/eventRoutes');
const recurringRoutes = require('./routes/recurringRoutes');
const pushRoutes = require('./routes/pushRoutes');
const { startRecurringScheduler, runDailyRecurringScan } = require('./jobs/recurringScheduler');
const profileRoutes = require('./routes/profileRoutes');
const bugReportRoutes = require('./routes/bugReportRoutes');
const app = express();
const announcementRoutes = require('./routes/announcementRoutes');
const exchangeRateRoutes = require('./routes/exchangeRateRoutes');
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Called daily by cron-job.org so recurring items run even if the 08:00 tick
// was missed while the instance was asleep. Protected by CRON_SECRET.
app.get('/cron/recurring', async (req, res) => {
  if (!process.env.CRON_SECRET || req.query.key !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await runDailyRecurringScan();
    return res.json({ status: 'ok', ...result });
  } catch (err) {
    console.error('[cron/recurring]', err);
    return res.status(500).json({ error: 'Scan failed' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/recurring-items', recurringRoutes);
app.use('/api/push-subscriptions', pushRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/exchange-rate', exchangeRateRoutes);

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler (routes should still try/catch and respond themselves;
// this is a safety net for anything that slips through)
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  startRecurringScheduler();
});
