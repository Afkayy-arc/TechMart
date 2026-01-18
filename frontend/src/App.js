import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Container, Grid, IconButton,
  Badge, Drawer, CircularProgress, Alert, Snackbar, Tabs, Tab,
  Button, Menu, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Divider, TextField, FormControl, InputLabel,
  Select, Paper, Stack
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import WarningIcon from '@mui/icons-material/Warning';
import FilterListIcon from '@mui/icons-material/FilterList';
import StorefrontIcon from '@mui/icons-material/Storefront';

import MetricCard from './components/MetricCard';
import SalesChart from './components/SalesChart';
import TransactionsTable from './components/TransactionsTable';
import AlertsPanel from './components/AlertsPanel';
import TopProductsTable from './components/TopProductsTable';
import FraudDetectionWidget from './components/FraudDetectionWidget';
import CategoryChart from './components/CategoryChart';
import InventoryPredictionWidget from './components/InventoryPredictionWidget';
import RFMAnalysisWidget from './components/RFMAnalysisWidget';
import ChurnRiskWidget from './components/ChurnRiskWidget';
import PerformanceWidget from './components/PerformanceWidget';

import { dashboardAPI, transactionsAPI, analyticsAPI, alertsAPI } from './services/api';
import wsService from './services/websocket';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Transaction detail modal
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState([]);

  // Data states
  const [overview, setOverview] = useState(null);
  const [hourlySales, setHourlySales] = useState([]);
  const [salesByCategory, setSalesByCategory] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [suspiciousTransactions, setSuspiciousTransactions] = useState([]);
  const [suspiciousSummary, setSuspiciousSummary] = useState(null);
  const [fraudTrends, setFraudTrends] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewData,
        hourlySalesData,
        categoryData,
        transactionsData,
        topProductsData,
        suspiciousData,
        fraudTrendsData,
        alertsData
      ] = await Promise.all([
        dashboardAPI.getOverview(),
        analyticsAPI.getHourlySales(24),
        dashboardAPI.getSalesByCategory(),
        dashboardAPI.getRecentTransactions(50),
        dashboardAPI.getTopProducts(10),
        transactionsAPI.getSuspicious({ limit: 20 }),
        analyticsAPI.getFraudTrends(7),
        alertsAPI.getAll({ resolved: false, limit: 50 })
      ]);

      setOverview(overviewData.data);
      setHourlySales(hourlySalesData.data);
      setSalesByCategory(categoryData.data);
      setRecentTransactions(transactionsData.data);
      setTopProducts(topProductsData.data);
      setSuspiciousTransactions(suspiciousData.data);
      setSuspiciousSummary(suspiciousData.summary);
      setFraudTrends(fraudTrendsData.data);
      setAlerts(alertsData.data);

      // Extract unique categories
      const uniqueCategories = [...new Set(categoryData.data?.map(c => c.category) || [])];
      setCategories(uniqueCategories);

    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load dashboard data. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Connect to WebSocket
    wsService.connect();

    // Listen for real-time updates
    const unsubscribeFraud = wsService.on('FRAUD_ALERT', (data) => {
      showSnackbar(`New fraud alert: ${data.data?.alert?.title}`, 'warning');
      fetchData(); // Refresh data
    });

    const unsubscribeConnected = wsService.on('connected', () => {
      console.log('WebSocket connected');
    });

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(fetchData, 30000);

    return () => {
      unsubscribeFraud();
      unsubscribeConnected();
      clearInterval(refreshInterval);
      wsService.disconnect();
    };
  }, [fetchData]);

  const handleMarkAlertRead = async (id) => {
    try {
      await alertsAPI.markRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (err) {
      showSnackbar('Failed to mark alert as read', 'error');
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      await alertsAPI.resolve(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      showSnackbar('Alert resolved', 'success');
    } catch (err) {
      showSnackbar('Failed to resolve alert', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsAPI.markAllRead();
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      showSnackbar('All alerts marked as read', 'success');
    } catch (err) {
      showSnackbar('Failed to mark all as read', 'error');
    }
  };

  const handleExport = async (type) => {
    try {
      const response = await analyticsAPI.exportData(type, 'csv');
      // Create download link
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export_${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSnackbar(`${type} exported successfully`, 'success');
    } catch (err) {
      showSnackbar('Export failed', 'error');
    }
    setExportMenuAnchor(null);
  };

  const handleTransactionClick = (transaction) => {
    setSelectedTransaction(transaction);
    setTransactionModalOpen(true);
  };

  const filteredTransactions = filterCategory
    ? recentTransactions.filter(t => t.Product?.category === filterCategory)
    : recentTransactions;

  const unreadAlertCount = (alerts || []).filter(a => !a.is_read).length;

  if (loading && !overview) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' }}
      >
        <StorefrontIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <CircularProgress size={48} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
          Loading TechMart Dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* App Bar with Gradient */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #0ea5e9 100%)',
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: 2,
                p: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <StorefrontIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                TechMart
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                Analytics Dashboard
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              color="inherit"
              startIcon={<DownloadIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
              PaperProps={{ sx: { mt: 1, minWidth: 160 } }}
            >
              <MenuItem onClick={() => handleExport('transactions')}>Transactions</MenuItem>
              <MenuItem onClick={() => handleExport('products')}>Products</MenuItem>
              <MenuItem onClick={() => handleExport('customers')}>Customers</MenuItem>
            </Menu>
            <IconButton
              color="inherit"
              onClick={fetchData}
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => setAlertsDrawerOpen(true)}
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <Badge badgeContent={unreadAlertCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Stack>
        </Toolbar>

        {/* Navigation Tabs */}
        <Box sx={{ bgcolor: 'rgba(0,0,0,0.15)' }}>
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            textColor="inherit"
            indicatorColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 2,
              '& .MuiTab-root': {
                minHeight: 56,
                opacity: 0.8,
                '&.Mui-selected': { opacity: 1 },
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                bgcolor: '#fff',
              },
            }}
          >
            <Tab label="Overview" />
            <Tab label="Transactions" />
            <Tab label="Fraud Detection" />
            <Tab label="Inventory" />
            <Tab label="Customer Analytics" />
            <Tab label="Performance" />
          </Tabs>
        </Box>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flex: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Overview Tab */}
        {activeTab === 0 && overview && (
          <Grid container spacing={3}>
            {/* Metric Cards */}
            <Grid item xs={12} sm={6} lg={3}>
              <MetricCard
                title="Total Revenue (24h)"
                value={`$${parseFloat(overview.totalRevenue).toLocaleString()}`}
                change={overview.revenueChange}
                icon={<AttachMoneyIcon />}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <MetricCard
                title="Transactions (24h)"
                value={overview.totalTransactions.toLocaleString()}
                change={overview.transactionChange}
                icon={<ShoppingCartIcon />}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <MetricCard
                title="Active Customers"
                value={overview.activeCustomers.toLocaleString()}
                subtitle={`Avg Order: $${overview.avgOrderValue}`}
                icon={<PeopleIcon />}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <MetricCard
                title="Alerts"
                value={overview.alertsCount}
                subtitle={`${overview.suspiciousCount} suspicious, ${overview.lowStockCount} low stock`}
                icon={<WarningIcon />}
                color="warning"
              />
            </Grid>

            {/* Sales Chart */}
            <Grid item xs={12} lg={8}>
              <SalesChart data={hourlySales} title="Sales Performance (24h)" />
            </Grid>

            {/* Category Chart */}
            <Grid item xs={12} lg={4}>
              <CategoryChart data={salesByCategory} />
            </Grid>

            {/* Top Products */}
            <Grid item xs={12} md={6}>
              <TopProductsTable products={topProducts} />
            </Grid>

            {/* Recent Transactions */}
            <Grid item xs={12} md={6}>
              <TransactionsTable
                transactions={recentTransactions.slice(0, 10)}
                title="Recent Transactions"
                showFraudScore={true}
                onRowClick={handleTransactionClick}
              />
            </Grid>
          </Grid>
        )}

        {/* Transactions Tab */}
        {activeTab === 1 && (
          <Grid container spacing={3}>
            {/* Filters */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FilterListIcon color="action" />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mr: 2 }}>
                  Filters:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filterCategory}
                    label="Category"
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map(cat => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {filterCategory && (
                  <Chip
                    label={`Category: ${filterCategory}`}
                    onDelete={() => setFilterCategory('')}
                    size="small"
                    color="primary"
                  />
                )}
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <TransactionsTable
                transactions={filteredTransactions}
                title="All Transactions"
                showFraudScore={true}
                onRowClick={handleTransactionClick}
              />
            </Grid>
          </Grid>
        )}

        {/* Fraud Detection Tab (Challenge A) */}
        {activeTab === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={4}>
              <FraudDetectionWidget
                suspiciousTransactions={suspiciousTransactions}
                summary={suspiciousSummary}
                trends={fraudTrends}
              />
            </Grid>
            <Grid item xs={12} lg={8}>
              <TransactionsTable
                transactions={suspiciousTransactions}
                title="Suspicious Transactions"
                showFraudScore={true}
                onRowClick={handleTransactionClick}
              />
            </Grid>
          </Grid>
        )}

        {/* Inventory Tab (Challenge B) */}
        {activeTab === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <InventoryPredictionWidget />
            </Grid>
          </Grid>
        )}

        {/* Customer Analytics Tab (Challenge C) */}
        {activeTab === 4 && (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <RFMAnalysisWidget />
            </Grid>
            <Grid item xs={12} lg={6}>
              <ChurnRiskWidget />
            </Grid>
          </Grid>
        )}

        {/* Performance Tab (Challenge D) */}
        {activeTab === 5 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <PerformanceWidget />
            </Grid>
          </Grid>
        )}
      </Container>

      {/* Transaction Detail Modal */}
      <Dialog
        open={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={600}>Transaction Details</Typography>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTransaction && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Transaction ID</Typography>
                <Typography variant="body1" fontWeight={500}>#{selectedTransaction.id}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box>
                  <Chip
                    label={selectedTransaction.status}
                    size="small"
                    color={
                      selectedTransaction.status === 'completed' ? 'success' :
                      selectedTransaction.status === 'pending' ? 'warning' :
                      selectedTransaction.status === 'flagged' ? 'error' : 'default'
                    }
                  />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Customer</Typography>
                <Typography variant="body1">{selectedTransaction.Customer?.name || 'N/A'}</Typography>
                <Typography variant="body2" color="text.secondary">{selectedTransaction.Customer?.email}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Product</Typography>
                <Typography variant="body1">{selectedTransaction.Product?.name || 'N/A'}</Typography>
                <Typography variant="body2" color="text.secondary">{selectedTransaction.Product?.category}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Quantity</Typography>
                <Typography variant="body1" fontWeight={500}>{selectedTransaction.quantity}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Unit Price</Typography>
                <Typography variant="body1" fontWeight={500}>${parseFloat(selectedTransaction.price).toFixed(2)}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                <Typography variant="body1" fontWeight={600} color="primary.main">
                  ${(selectedTransaction.quantity * parseFloat(selectedTransaction.price)).toFixed(2)}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Payment Method</Typography>
                <Typography variant="body1">{selectedTransaction.payment_method}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                <Typography variant="body1">
                  {new Date(selectedTransaction.timestamp).toLocaleString()}
                </Typography>
              </Grid>
              {selectedTransaction.fraud_score !== undefined && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Fraud Score</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color={
                          selectedTransaction.fraud_score > 70 ? 'error.main' :
                          selectedTransaction.fraud_score > 40 ? 'warning.main' : 'success.main'
                        }
                      >
                        {selectedTransaction.fraud_score}
                      </Typography>
                      <Chip
                        label={
                          selectedTransaction.fraud_score > 70 ? 'High Risk' :
                          selectedTransaction.fraud_score > 40 ? 'Medium Risk' : 'Low Risk'
                        }
                        size="small"
                        color={
                          selectedTransaction.fraud_score > 70 ? 'error' :
                          selectedTransaction.fraud_score > 40 ? 'warning' : 'success'
                        }
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Severity</Typography>
                    <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                      {selectedTransaction.severity || 'N/A'}
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTransactionModalOpen(false)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alerts Drawer */}
      <Drawer
        anchor="right"
        open={alertsDrawerOpen}
        onClose={() => setAlertsDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <AlertsPanel
          alerts={alerts}
          onMarkRead={handleMarkAlertRead}
          onResolve={handleResolveAlert}
          onMarkAllRead={handleMarkAllRead}
        />
      </Drawer>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
