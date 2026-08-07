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
const { startRecurringScheduler } = require('./jobs/recurringScheduler');
const profileRoutes = require('./routes/profileRoutes');
const bugReportRoutes = require('./routes/bugReportRoutes');
const app = express();
const announcementRoutes = require('./routes/announcementRoutes');
const exchangeRateRoutes = require('./routes/exchangeRateRoutes');
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

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
// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api/exchange-rate', exchangeRateRoutes);

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
