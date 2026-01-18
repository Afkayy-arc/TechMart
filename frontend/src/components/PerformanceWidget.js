import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Paper,
  LinearProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { cacheAPI } from '../services/api';

export default function PerformanceWidget() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cacheAPI.getStats();
      console.log('Cache stats response:', response);
      if (response && response.success) {
        setStats(response.data);
      } else {
        setError(response?.error || 'Invalid response');
      }
    } catch (err) {
      console.error('Cache stats fetch error:', err);
      setError(err?.error || err?.message || 'Failed to fetch cache stats');
    } finally {
      setLoading(false);
    }
  };

  const handleFlushCache = async () => {
    try {
      await cacheAPI.flush();
      fetchStats();
    } catch (err) {
      setError(err.message || 'Failed to flush cache');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  const hitRate = stats?.hitRate ? (stats.hitRate * 100).toFixed(1) : 0;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Performance Optimization (Challenge D)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchStats}
            >
              Refresh
            </Button>
            <Button
              size="small"
              color="warning"
              startIcon={<DeleteSweepIcon />}
              onClick={handleFlushCache}
            >
              Flush Cache
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Cache Hit Rate
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={parseFloat(hitRate)}
                  sx={{ flexGrow: 1, height: 10, borderRadius: 5 }}
                  color={hitRate >= 70 ? 'success' : hitRate >= 40 ? 'warning' : 'error'}
                />
                <Typography variant="h6">{hitRate}%</Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Cache Hits
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats?.hits || 0}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Cache Misses
              </Typography>
              <Typography variant="h4" color="error.main">
                {stats?.misses || 0}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Cached Keys
              </Typography>
              <Typography variant="h4" color="primary.main">
                {stats?.keys || 0}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Cache Sets
              </Typography>
              <Typography variant="h4" color="info.main">
                {stats?.sets || 0}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Optimization Features Active
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" component="span" sx={{ bgcolor: 'success.light', px: 1, py: 0.5, borderRadius: 1 }}>
                  Response Caching (60-120s TTL)
                </Typography>
                <Typography variant="body2" component="span" sx={{ bgcolor: 'success.light', px: 1, py: 0.5, borderRadius: 1 }}>
                  Rate Limiting (100 req/min)
                </Typography>
                <Typography variant="body2" component="span" sx={{ bgcolor: 'success.light', px: 1, py: 0.5, borderRadius: 1 }}>
                  Request Timing Headers
                </Typography>
                <Typography variant="body2" component="span" sx={{ bgcolor: 'success.light', px: 1, py: 0.5, borderRadius: 1 }}>
                  Query Optimization
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
