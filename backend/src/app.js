const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const jiraRoutes = require('./routes/jiraRoutes');
const testManagementRoutes = require('./routes/testManagementRoutes');
const { errorMiddleware } = require('./middlewares/errorMiddleware');
const { csrfProtection } = require('./middlewares/csrfMiddleware');

const app = express();

if (String(process.env.TRUST_PROXY || '').trim() === '1') {
  app.set('trust proxy', 1);
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use('/api', csrfProtection);

app.get('/', (req, res) => {
  res.json({ message: 'Test Case Management API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api', testManagementRoutes);

app.use(errorMiddleware);

module.exports = app;
