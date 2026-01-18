import React from 'react';
import { Card, CardContent, Typography, Box, Chip, alpha } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

const gradients = {
  primary: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  info: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  secondary: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
};

const lightColors = {
  primary: '#eff6ff',
  success: '#ecfdf5',
  warning: '#fffbeb',
  error: '#fef2f2',
  info: '#ecfeff',
  secondary: '#f5f3ff',
};

const MetricCard = ({ title, value, subtitle, change, changeLabel, icon, color = 'primary' }) => {
  const isPositiveChange = change >= 0;
  const changeColor = isPositiveChange ? 'success' : 'error';

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 20px -5px rgba(0,0,0,0.12)',
        },
      }}
    >
      {/* Decorative gradient accent */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: gradients[color] || gradients.primary,
        }}
      />

      <CardContent sx={{ pt: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography
              color="text.secondary"
              variant="body2"
              fontWeight={500}
              sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}
            >
              {title}
            </Typography>
            <Typography
              variant="h4"
              component="div"
              fontWeight="bold"
              sx={{
                color: 'text.primary',
                lineHeight: 1.2,
                mb: 0.5,
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, fontSize: '0.8rem' }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                background: lightColors[color] || lightColors.primary,
                borderRadius: 3,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ml: 2,
              }}
            >
              {React.cloneElement(icon, {
                sx: {
                  fontSize: 28,
                  color: `${color}.main`,
                }
              })}
            </Box>
          )}
        </Box>

        {change !== undefined && (
          <Box display="flex" alignItems="center" mt={2.5} pt={2} borderTop="1px solid" borderColor="divider">
            <Chip
              size="small"
              icon={isPositiveChange ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${isPositiveChange ? '+' : ''}${change}%`}
              color={changeColor}
              sx={{
                mr: 1.5,
                fontWeight: 600,
                '& .MuiChip-icon': { fontSize: 16 },
              }}
            />
            <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
              {changeLabel || 'vs previous period'}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricCard;
