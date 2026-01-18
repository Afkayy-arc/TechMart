import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  Grid,
  Divider,
} from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { inventoryAPI } from '../services/api';

const getUrgencyColor = (urgency) => {
  switch (urgency) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    default: return 'default';
  }
};

const getUrgencyIcon = (urgency) => {
  switch (urgency) {
    case 'critical': return <ErrorOutlineIcon sx={{ fontSize: 18 }} />;
    case 'high': return <WarningAmberIcon sx={{ fontSize: 18 }} />;
    default: return <TrendingDownIcon sx={{ fontSize: 18 }} />;
  }
};

export default function InventoryPredictionWidget() {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await inventoryAPI.getReorderSuggestions();
      if (response && response.success) {
        setSuggestions(response.data);
      } else {
        setError(response?.error || 'Invalid response');
      }
    } catch (err) {
      console.error('Inventory fetch error:', err);
      setError(err?.error || err?.message || 'Failed to fetch reorder suggestions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Box textAlign="center">
            <CircularProgress size={48} thickness={4} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading inventory data...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              bgcolor: 'primary.light',
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <InventoryIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Inventory Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reorder suggestions based on sales velocity
            </Typography>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'error.lighter',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'error.light',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ErrorOutlineIcon color="error" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" color="error.dark">Critical</Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="error.main">
                {suggestions?.criticalCount || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Items out of stock
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'warning.lighter',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'warning.light',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WarningAmberIcon color="warning" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" color="warning.dark">High Priority</Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {suggestions?.highCount || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Items running low
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'info.lighter',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'info.light',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LocalShippingIcon color="info" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" color="info.dark">Total Orders</Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="info.main">
                {suggestions?.totalSuggestions || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Suggested reorders
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 2 }} />

        {/* Table */}
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Category</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Stock</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Days Left</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Reorder Qty</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Est. Cost</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Urgency</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suggestions?.suggestions?.slice(0, 20).map((item) => (
                <TableRow
                  key={item.product.id}
                  sx={{
                    '&:hover': { bgcolor: 'action.hover' },
                    bgcolor: item.urgency === 'critical' ? 'error.lighter' : 'inherit',
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {item.product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SKU: {item.product.sku}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.product.category}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 60 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, (item.product.currentStock / 50) * 100)}
                          color={item.product.currentStock === 0 ? 'error' : item.product.currentStock < 10 ? 'warning' : 'primary'}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={item.product.currentStock === 0 ? 'error.main' : 'text.primary'}
                      >
                        {item.product.currentStock}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={
                        item.reorderAnalysis.daysUntilStockout === 0 ? 'error.main' :
                        item.reorderAnalysis.daysUntilStockout <= 3 ? 'warning.main' : 'text.primary'
                      }
                    >
                      {item.reorderAnalysis.daysUntilStockout ?? 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {item.reorderAnalysis.recommendedQuantity}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      ${parseFloat(item.reorderAnalysis.estimatedCost).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      icon={getUrgencyIcon(item.urgency)}
                      label={item.urgency}
                      size="small"
                      color={getUrgencyColor(item.urgency)}
                      sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {suggestions?.suggestions?.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <InventoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">
              No reorder suggestions at this time. All stock levels are healthy!
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
