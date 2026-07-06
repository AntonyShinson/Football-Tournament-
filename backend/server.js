import 'dotenv/config';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import { connectDB } from './src/db.js';
import tournamentsRouter from './src/routes/tournaments.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/tournaments', tournamentsRouter);

// Central error handler — catches anything thrown/rejected in a route so the API
// always returns JSON instead of crashing or leaking a stack trace.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`FootballHub API listening on :${PORT}`)))
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
