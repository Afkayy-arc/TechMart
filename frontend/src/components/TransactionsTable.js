import React, { useState } from 'react';
import {
  Card, CardContent, CardHeader, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Typography, Box, TextField,
  InputAdornment, Menu, MenuItem, TablePagination, TableSortLabel
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { format, isValid } from 'date-fns';

const formatDate = (dateStr, pattern = 'MMM d, HH:mm') => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return isValid(date) ? format(date, pattern) : 'N/A';
};

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'success';
    case 'pending': return 'warning';
    case 'failed': return 'error';
    case 'flagged': return 'error';
    case 'refunded': return 'info';
    default: return 'default';
  }
};

const getFraudSeverityColor = (score) => {
  if (score >= 70) return 'error';
  if (score >= 40) return 'warning';
  return 'success';
};

const TransactionsTable = ({ transactions, title = 'Recent Transactions', showFraudScore = true, onRowClick }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [orderBy, setOrderBy] = useState('timestamp');
  const [order, setOrder] = useState('desc');

  const filteredTransactions = (transactions || []).filter(t => {
    const matchesSearch = search === '' ||
      t.Customer?.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.Customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.Product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toString().includes(search);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let aVal, bVal;
    switch (orderBy) {
      case 'amount':
        aVal = parseFloat(a.total_amount || a.price * a.quantity || 0);
        bVal = parseFloat(b.total_amount || b.price * b.quantity || 0);
        break;
      case 'fraud_score':
        aVal = a.fraud_score || 0;
        bVal = b.fraud_score || 0;
        break;
      case 'timestamp':
      default:
        aVal = new Date(a.timestamp).getTime();
        bVal = new Date(b.timestamp).getTime();
    }
    return order === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleRowClick = (transaction) => {
    if (onRowClick) {
      onRowClick(transaction);
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
        }
        action={
          <Box display="flex" gap={1} alignItems="center">
            <TextField
              size="small"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'background.default',
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <IconButton
              onClick={(e) => setFilterAnchor(e.currentTarget)}
              sx={{
                bgcolor: statusFilter !== 'all' ? 'primary.light' : 'background.default',
                '&:hover': { bgcolor: statusFilter !== 'all' ? 'primary.main' : 'action.hover' },
              }}
            >
              <FilterListIcon color={statusFilter !== 'all' ? 'primary' : 'action'} />
            </IconButton>
            <Menu
              anchorEl={filterAnchor}
              open={Boolean(filterAnchor)}
              onClose={() => setFilterAnchor(null)}
              PaperProps={{ sx: { mt: 1, minWidth: 150 } }}
            >
              <MenuItem
                onClick={() => { setStatusFilter('all'); setFilterAnchor(null); }}
                selected={statusFilter === 'all'}
              >
                All Statuses
              </MenuItem>
              <MenuItem
                onClick={() => { setStatusFilter('completed'); setFilterAnchor(null); }}
                selected={statusFilter === 'completed'}
              >
                Completed
              </MenuItem>
              <MenuItem
                onClick={() => { setStatusFilter('pending'); setFilterAnchor(null); }}
                selected={statusFilter === 'pending'}
              >
                Pending
              </MenuItem>
              <MenuItem
                onClick={() => { setStatusFilter('flagged'); setFilterAnchor(null); }}
                selected={statusFilter === 'flagged'}
              >
                Flagged
              </MenuItem>
              <MenuItem
                onClick={() => { setStatusFilter('failed'); setFilterAnchor(null); }}
                selected={statusFilter === 'failed'}
              >
                Failed
              </MenuItem>
            </Menu>
          </Box>
        }
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TableContainer sx={{ flex: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={orderBy === 'amount'}
                    direction={orderBy === 'amount' ? order : 'asc'}
                    onClick={() => handleSort('amount')}
                  >
                    Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                {showFraudScore && (
                  <TableCell sx={{ fontWeight: 600 }}>
                    <TableSortLabel
                      active={orderBy === 'fraud_score'}
                      direction={orderBy === 'fraud_score' ? order : 'asc'}
                      onClick={() => handleSort('fraud_score')}
                    >
                      Risk
                    </TableSortLabel>
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={orderBy === 'timestamp'}
                    direction={orderBy === 'timestamp' ? order : 'asc'}
                    onClick={() => handleSort('timestamp')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showFraudScore ? 7 : 6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No transactions found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTransactions
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((transaction) => {
                    const amount = transaction.total_amount || (transaction.price * transaction.quantity);
                    const fraudScore = transaction.fraud_score || 0;

                    return (
                      <TableRow
                        key={transaction.id}
                        hover
                        onClick={() => handleRowClick(transaction)}
                        sx={{
                          cursor: onRowClick ? 'pointer' : 'default',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500} color="primary.main">
                            #{transaction.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {transaction.Customer?.name || `${transaction.Customer?.first_name || ''} ${transaction.Customer?.last_name || ''}`.trim() || 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {transaction.Customer?.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                            {transaction.Product?.name || 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {transaction.Product?.category}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(amount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={transaction.status}
                            size="small"
                            color={getStatusColor(transaction.status)}
                            sx={{ textTransform: 'capitalize', fontWeight: 500 }}
                          />
                        </TableCell>
                        {showFraudScore && (
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              {fraudScore >= 40 ? (
                                <Chip
                                  icon={<WarningAmberIcon sx={{ fontSize: 16 }} />}
                                  label={fraudScore}
                                  size="small"
                                  color={getFraudSeverityColor(fraudScore)}
                                  sx={{ fontWeight: 600 }}
                                />
                              ) : (
                                <Chip
                                  icon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
                                  label="Low"
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  sx={{ fontWeight: 500 }}
                                />
                              )}
                            </Box>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(transaction.timestamp)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={sortedTransactions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </CardContent>
    </Card>
  );
};

export default TransactionsTable;
