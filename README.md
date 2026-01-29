# Jinah Dashboard Backend API

Backend API that fetches real market data from multiple free APIs.

## Data Sources

| API | Purpose | Rate Limit | API Key |
|-----|---------|------------|---------|
| Yahoo Finance | Futures prices (ES, NQ, YM, RTY, CL, GC, ZN, VIX) | Unlimited | Not needed |
| Alpha Vantage | News sentiment, earnings | 25/day free | [Get Key](https://www.alphavantage.co/support/#api-key) |
| FRED | Fed data, economic indicators | Unlimited | [Get Key](https://fred.stlouisfed.org/docs/api/api_key.html) |
| Polygon.io | Market status, aggregates | 5/min free | [Get Key](https://polygon.io/dashboard/signup) |

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Get your free API keys (links above)

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Add your API keys to `.env`:
   ```
   ALPHA_VANTAGE_API_KEY=your_key_here
   FRED_API_KEY=your_key_here
   POLYGON_API_KEY=your_key_here
   ```

5. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

### GET /api/dashboard
Returns the complete dashboard data.

### GET /api/health
Health check endpoint.

### POST /api/dashboard/refresh
Clears the cache and forces fresh data fetch.

## Deployment Options

### Option 1: Railway (Recommended)
1. Push to GitHub
2. Connect to [Railway](https://railway.app)
3. Add environment variables
4. Deploy

### Option 2: Render
1. Push to GitHub
2. Create new Web Service on [Render](https://render.com)
3. Add environment variables
4. Deploy

### Option 3: Vercel (Serverless)
Convert `server.js` to serverless function in `api/dashboard.js`

## Caching

Data is cached for 5 minutes to:
- Respect API rate limits
- Improve response times
- Reduce API calls

Use `/api/dashboard/refresh` to force a fresh fetch.
