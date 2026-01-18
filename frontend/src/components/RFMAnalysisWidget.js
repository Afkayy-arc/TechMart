import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Paper,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { customersAPI } from '../services/api';

const SEGMENT_COLORS = {
  'Champions': '#4caf50',
  'Loyal Customers': '#8bc34a',
  'New Customers': '#03a9f4',
  'Potential Loyalists': '#00bcd4',
  'At Risk': '#ff9800',
  'Need Attention': '#ff5722',
  'Lost': '#f44336',
  'Big Spenders': '#9c27b0',
  'Others': '#9e9e9e',
};

export default function RFMAnalysisWidget() {
  const [rfmData, setRfmData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRFMData();
  }, []);

  const fetchRFMData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customersAPI.getRFMAnalysis();
      console.log('RFM response:', response);
      if (response && response.success) {
        setRfmData(response.data);
      } else {
        setError(response?.error || 'Invalid response');
      }
    } catch (err) {
      console.error('RFM fetch error:', err);
      setError(err?.error || err?.message || 'Failed to fetch RFM analysis');
    } finally {
      setLoading(false);
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

  const segmentData = rfmData?.segments
    ? Object.entries(rfmData.segments).map(([name, data]) => ({
        name,
        value: data.count,
        color: SEGMENT_COLORS[name] || '#9e9e9e',
      }))
    : [];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          RFM Customer Segmentation (Challenge C)
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Total Customers Analyzed: {rfmData?.totalCustomers || 0}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Segment Breakdown
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {segmentData.map((segment) => (
                <Paper
                  key={segment.name}
                  variant="outlined"
                  sx={{
                    p: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderLeft: `4px solid ${segment.color}`,
                  }}
                >
                  <Typography variant="body2">{segment.name}</Typography>
                  <Chip
                    label={segment.value}
                    size="small"
                    sx={{ bgcolor: segment.color, color: 'white' }}
                  />
                </Paper>
              ))}
            </Box>
          </Grid>
        </Grid>

        {rfmData?.topCustomers && rfmData.topCustomers.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Top 5 Customers by RFM Score
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {rfmData.topCustomers.slice(0, 5).map((customer) => (
                <Chip
                  key={customer.customerId}
                  label={`${customer.name} (Score: ${customer.totalScore})`}
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
