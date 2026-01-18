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
} from '@mui/material';
import { customersAPI } from '../services/api';

const getRiskColor = (risk) => {
  switch (risk) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    default: return 'default';
  }
};

export default function ChurnRiskWidget() {
  const [churnData, setChurnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChurnData();
  }, []);

  const fetchChurnData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customersAPI.getChurnRisk();
      console.log('Churn response:', response);
      if (response && response.success) {
        setChurnData(response.data);
      } else {
        setError(response?.error || 'Invalid response');
      }
    } catch (err) {
      console.error('Churn fetch error:', err);
      setError(err?.error || err?.message || 'Failed to fetch churn risk data');
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

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Churn Risk Analysis (Challenge C)
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip
            label={`Total At Risk: ${churnData?.totalAtRisk || 0}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`Critical: ${churnData?.criticalCount || 0}`}
            color="error"
          />
          <Chip
            label={`High: ${churnData?.highCount || 0}`}
            color="warning"
          />
          <Chip
            label={`Medium: ${churnData?.mediumCount || 0}`}
            color="info"
          />
        </Box>

        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Loyalty Tier</TableCell>
                <TableCell align="right">Total Spent</TableCell>
                <TableCell align="right">Days Since Purchase</TableCell>
                <TableCell>Churn Probability</TableCell>
                <TableCell>Risk Level</TableCell>
                <TableCell>Suggested Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {churnData?.customers?.slice(0, 15).map((item) => (
                <TableRow key={item.customer.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.customer.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.customer.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.customer.loyaltyTier || 'Standard'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">${item.metrics.totalSpent}</TableCell>
                  <TableCell align="right">
                    <Typography
                      color={item.metrics.daysSinceLastPurchase > 60 ? 'error.main' : 'text.primary'}
                    >
                      {item.metrics.daysSinceLastPurchase}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="medium" color="error.main">
                      {item.churnProbability}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.riskLevel}
                      size="small"
                      color={getRiskColor(item.riskLevel)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {item.suggestedAction}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {churnData?.customers?.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No customers at risk of churning.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
