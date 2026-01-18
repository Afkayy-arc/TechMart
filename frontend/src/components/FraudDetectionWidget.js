import React from 'react';
import {
  Card, CardContent, CardHeader, Box, Typography, Chip,
  List, ListItem, ListItemText, Avatar, LinearProgress, Divider
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

const SEVERITY_COLORS = {
  critical: '#d32f2f',
  high: '#ed6c02',
  medium: '#0288d1',
  low: '#2e7d32'
};

const FraudDetectionWidget = ({ suspiciousTransactions, summary, trends }) => {
  const pieData = summary ? [
    { name: 'Critical', value: summary.critical || 0, color: SEVERITY_COLORS.critical },
    { name: 'High', value: summary.high || 0, color: SEVERITY_COLORS.high },
    { name: 'Medium', value: summary.medium || 0, color: SEVERITY_COLORS.medium }
  ].filter(d => d.value > 0) : [];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={<SecurityIcon color="warning" />}
        title="Fraud Detection"
        subheader={`${summary?.total || 0} suspicious transactions detected`}
      />
      <CardContent>
        {/* Summary Chart */}
        {pieData.length > 0 && (
          <Box height={200} mb={2}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Recent Suspicious Transactions */}
        <Typography variant="subtitle2" gutterBottom>
          Recent Suspicious Activity
        </Typography>
        <List dense disablePadding>
          {(suspiciousTransactions || []).slice(0, 5).map((transaction) => (
            <ListItem key={transaction.id} sx={{ px: 0 }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  mr: 1.5,
                  bgcolor: transaction.fraud_score >= 0.8 ? 'error.main'
                    : transaction.fraud_score >= 0.6 ? 'warning.main' : 'info.main'
                }}
              >
                <WarningIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">
                      #{transaction.id} - {formatCurrency(transaction.total_amount)}
                    </Typography>
                    <Chip
                      label={`${(transaction.fraud_score * 100).toFixed(0)}%`}
                      size="small"
                      color={
                        transaction.fraud_score >= 0.8 ? 'error'
                          : transaction.fraud_score >= 0.6 ? 'warning' : 'info'
                      }
                    />
                  </Box>
                }
                secondary={
                  <Typography variant="caption" color="textSecondary">
                    {transaction.Customer?.email}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        {/* Fraud Score Distribution */}
        {trends && trends.length > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              7-Day Trend
            </Typography>
            {trends.map((day, index) => (
              <Box key={index} mb={1}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption">{day.date}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {day.suspiciousCount}/{day.totalTransactions} ({day.suspiciousRate}%)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(parseFloat(day.suspiciousRate) * 5, 100)}
                  color={parseFloat(day.suspiciousRate) > 10 ? 'error' : 'warning'}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default FraudDetectionWidget;
