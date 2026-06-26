/**
 * SwarmLeads Worker Bee API Server
 * Runs on port 4000, proxied from Vite on port 3000
 * Bee chain: Scraper -> Strategist -> Writer
 */

import express from 'express';
import cors from 'cors';
import { scrapeLeads, getStoredLeads } from './scraper-bee.mjs';
import { runStrategist, getLeadStats } from './strategist-bee.mjs';
import { runWriter } from './writer-bee.mjs';
import { simulateBounceBack, getBounceBackLogs } from './bounceback-bee.mjs';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1', bees: ['Scraper Bee', 'Strategist Bee', 'Writer Bee'] });
});

// Trigger scraping - chains: Scraper -> Strategist -> Writer
app.post('/api/scrape', async (req, res) => {
  try {
    const { industry, region, target } = req.body;
    
    if (!industry || !region) {
      return res.status(400).json({ error: 'industry and region are required' });
    }

    // Fire-and-forget scraping with full bee chain
    scrapeLeads({ industry, region, target: target || 50 })
      .then(leads => {
        console.log(`Scraper Bee completed: ${leads.length} leads found for ${industry} in ${region}`);
        // Chain: Strategist Bee
        const stratResult = runStrategist();
        console.log(stratResult.message);
        // Chain: Writer Bee
        const writerResult = runWriter();
        console.log(writerResult.message);
      })
      .catch(err => {
        console.error('Scraper Bee error:', err.message);
      });

    res.json({
      message: `Worker Bees deployed for ${industry} in ${region}`,
      industry,
      region,
      target: target || 50,
      status: 'running',
      chain: ['Scraper Bee', 'Strategist Bee', 'Writer Bee'],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger strategist analysis (also chains to writer)
app.post('/api/strategize', (req, res) => {
  try {
    const stratResult = runStrategist();
    // Auto-chain Writer Bee
    const writerResult = runWriter();
    res.json({ strategist: stratResult, writer: writerResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger writer bee only
app.post('/api/write', (req, res) => {
  try {
    const result = runWriter();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all leads with stats
app.get('/api/leads', (req, res) => {
  try {
    const leads = getStoredLeads();
    const stats = getLeadStats();
    
    // Add score to each lead
    const scoredLeads = leads.map(lead => ({
      ...lead,
      score: lead.status === 'high_intent' ? Math.floor(75 + Math.random() * 25) :
             lead.status === 'verified' ? Math.floor(50 + Math.random() * 25) :
             Math.floor(20 + Math.random() * 30),
    }));

    res.json({
      leads: scoredLeads,
      count: leads.length,
      stats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats only (for frontend polling)
app.get('/api/stats', (req, res) => {
  try {
    const stats = getLeadStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BounceBack SMS endpoints
app.post('/api/bounceback/simulate', (req, res) => {
  try {
    const { incomingNumber, industry, region, businessName } = req.body;
    const result = simulateBounceBack({ incomingNumber, industry, region, businessName });
    res.json({ success: true, log: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bounceback/logs', (req, res) => {
  try {
    const logs = getBounceBackLogs();
    res.json({ logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Worker Bee API running on http://127.0.0.1:${PORT}`);
});