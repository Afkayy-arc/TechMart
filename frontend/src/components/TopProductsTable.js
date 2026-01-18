import React from 'react';
import {
  Card, CardContent, CardHeader, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Box, Typography,
  LinearProgress
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const getStockStatus = (quantity) => {
  if (quantity === 0) return { label: 'Out of Stock', color: 'error' };
  if (quantity <= 10) return { label: 'Low Stock', color: 'warning' };
  if (quantity <= 50) return { label: 'Medium', color: 'info' };
  return { label: 'In Stock', color: 'success' };
};

const TopProductsTable = ({ products, title = 'Top Products' }) => {
  const maxRevenue = Math.max(...products.map(p => parseFloat(p.totalRevenue) || 0));

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={title}
        avatar={<TrendingUpIcon color="primary" />}
      />
      <CardContent sx={{ p: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Sold</TableCell>
                <TableCell>Stock</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product, index) => {
                const stockStatus = getStockStatus(product.Product?.stock_quantity);
                const revenuePercent = (parseFloat(product.totalRevenue) / maxRevenue) * 100;

                return (
                  <TableRow key={product.product_id || index} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {product.Product?.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {product.Product?.category}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {formatCurrency(product.totalRevenue)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={revenuePercent}
                          sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {product.totalQuantity} units
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${product.Product?.stock_quantity || 0}`}
                        size="small"
                        color={stockStatus.color}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default TopProductsTable;
