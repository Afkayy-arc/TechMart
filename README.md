# TechMart Analytics Dashboard

A real-time analytics dashboard for the TechMart e-commerce platform, featuring transaction monitoring, fraud detection, and actionable business insights.

## Features

### Core Features
- **Real-time Dashboard**: Live metrics including revenue, transactions, active customers, and alerts
- **Transaction Management**: View, filter, and analyze all transactions with pagination
- **Fraud Detection System**: Multi-algorithm fraud scoring with real-time alerts
- **Inventory Tracking**: Low stock alerts with reorder recommendations
- **Data Export**: Export transactions, products, and customers as CSV

### Fraud Detection (Challenge A)
The system implements a comprehensive fraud detection engine that scores transactions based on:
- **Velocity Checks**: Detects rapid successive purchases (>5 transactions in 10 minutes)
- **Amount Anomalies**: Flags transactions exceeding $10,000 or 3x customer average
- **Time Pattern Analysis**: Identifies purchases during unusual hours (2-5 AM)
- **Customer Risk Scoring**: Incorporates historical risk data
- **Bot Detection**: Analyzes user agents for automated requests

### Technology Stack
- **Backend**: Node.js, Express.js, SQLite, Sequelize ORM
- **Frontend**: React 18, Material-UI, Recharts
- **Real-time**: WebSocket for live updates
- **Data**: 5000+ transactions, 1000 customers, 500 products, 50 suppliers

## Installation & Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Backend Setup

```bash
# Navigate to backend directory
cd techmart-dashboard/backend

# Install dependencies
npm install

# Import data from CSV files
npm run seed

# Start the server
npm start
```

The backend will start at `http://localhost:3001`

### Frontend Setup

```bash
# Navigate to frontend directory
cd techmart-dashboard/frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend will start at `http://localhost:3000`

## Production Deployment

### Option 1: Docker (Recommended)

```bash
# Build and run with Docker Compose
cd techmart-dashboard
docker-compose up -d --build

# The application will be available at:
# - Frontend: http://localhost (port 80)
# - Backend API: http://localhost:3001
```

To stop:
```bash
docker-compose down
```

### Option 2: Manual Deployment

**Build Frontend:**
```bash
cd frontend
npm run build
# Serve the 'build' folder with nginx, Apache, or any static file server
```

**Run Backend:**
```bash
cd backend
npm ci --only=production
NODE_ENV=production node src/index.js
```

### Option 3: Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start src/index.js --name techmart-api

# Serve frontend with serve
npm install -g serve
cd frontend
pm2 start serve --name techmart-frontend -- -s build -l 3000
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend server port | `3001` |
| `DATABASE_URL` | Database path/connection | `./database.sqlite` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost` |

## API Documentation

### Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/overview` | GET | Summary statistics for last 24h |
| `/api/dashboard/sales-by-category` | GET | Sales breakdown by category |
| `/api/dashboard/recent-transactions` | GET | Recent transactions list |
| `/api/dashboard/top-products` | GET | Top selling products |

### Transaction Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transactions` | GET | List transactions (with filtering) |
| `/api/transactions` | POST | Create new transaction |
| `/api/transactions/suspicious` | GET | Get fraudulent transactions |
| `/api/transactions/:id` | GET | Get transaction details |

### Inventory Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inventory` | GET | List all products |
| `/api/inventory/low-stock` | GET | Products below threshold |
| `/api/inventory/categories` | GET | Category summary |

### Analytics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/hourly-sales` | GET | Hourly sales data |
| `/api/analytics/daily-sales` | GET | Daily sales data |
| `/api/analytics/payment-methods` | GET | Payment method breakdown |
| `/api/analytics/fraud-trends` | GET | Fraud detection trends |
| `/api/analytics/export` | GET | Export data (CSV/JSON) |

### Alert Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/alerts` | GET | List all alerts |
| `/api/alerts` | POST | Create custom alert |
| `/api/alerts/:id/read` | PUT | Mark alert as read |
| `/api/alerts/:id/resolve` | PUT | Resolve alert |

## Architecture

```
techmart-dashboard/
├── backend/
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── models/         # Sequelize models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic (fraud detection)
│   │   ├── seeders/        # Data import scripts
│   │   └── index.js        # Express server
│   ├── Dockerfile          # Backend container config
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API & WebSocket services
│   │   ├── App.js          # Main application
│   │   └── index.js        # Entry point
│   ├── build/              # Production build output
│   ├── Dockerfile          # Frontend container config
│   ├── nginx.conf          # Nginx configuration
│   └── package.json
├── docker-compose.yml      # Docker orchestration
├── README.md
└── WORKLOG.md              # Development work log
```

## Design Decisions

### Database
- **SQLite**: Chosen for simplicity and zero-configuration setup
- **Sequelize ORM**: Provides model definitions, associations, and query building
- Schema designed with proper foreign keys and indexes

### Fraud Detection Algorithm
The fraud scoring system uses a weighted approach:
- Amount exceeds limit: +40 points
- Velocity exceeded: +30 points
- Amount deviation: +25 points
- High-risk customer: +25 points
- Missing/bot user agent: +15-20 points
- Unusual time: +15 points

Scores are normalized to 0-1, with thresholds:
- Critical: ≥0.8
- High: ≥0.6
- Medium: ≥0.4

### Real-time Updates
WebSocket connection broadcasts:
- New fraud alerts
- Transaction updates
- Stock level changes

### Frontend Architecture
- Component-based design with reusable widgets
- Centralized API service with axios
- Material-UI for consistent styling
- Recharts for data visualization

## Assumptions Made

1. **Data Format**: Transaction timestamps may vary in format; the importer handles ISO and common date formats
2. **Currency**: All amounts are in USD
3. **Timezone**: Server local timezone is used for time-based fraud detection
4. **Stock Updates**: Stock levels are automatically decremented on successful transactions
5. **Risk Scores**: Customer risk scores range from 0 (low risk) to 1 (high risk)

## Limitations & Future Improvements

### Current Limitations
- SQLite may not scale for high concurrent loads
- No user authentication system
- Limited to predefined fraud rules (no ML)
- Export limited to CSV format

### Potential Improvements
1. **Database**: Migrate to PostgreSQL for production
2. **Caching**: Add Redis for frequently accessed data
3. **Authentication**: Implement JWT-based auth
4. **ML Fraud Detection**: Integrate anomaly detection models
5. **Notifications**: Email/SMS alerts for critical events
6. **Testing**: Add comprehensive unit and integration tests
7. **Docker**: Containerize for easy deployment

## Performance Considerations

- API responses are paginated (default 20 items)
- Database queries use proper indexes on `customer_id`, `product_id`, `timestamp`
- Frontend implements debounced search
- WebSocket reduces polling overhead
- Data fetched in parallel where possible



Built for SageTeck Employee Evaluation Task
