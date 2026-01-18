import React, { useState } from 'react';
import {
  Card, CardContent, CardHeader, List, ListItem, ListItemIcon, ListItemText,
  Chip, IconButton, Typography, Box, Collapse, Button, Badge, Divider
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import InventoryIcon from '@mui/icons-material/Inventory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { format, isValid } from 'date-fns';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return isValid(date) ? format(date, 'MMM d, HH:mm') : 'N/A';
};

const getAlertIcon = (type, severity) => {
  if (severity === 'critical') return <ErrorIcon color="error" />;
  if (type === 'fraud') return <WarningAmberIcon color="warning" />;
  if (type === 'low_stock') return <InventoryIcon color="info" />;
  return <InfoIcon color="primary" />;
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    default: return 'default';
  }
};

const AlertsPanel = ({ alerts, onMarkRead, onResolve, onMarkAllRead, title = 'Alerts' }) => {
  const [expanded, setExpanded] = useState({});
  const unreadCount = alerts.filter(a => !a.is_read).length;

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            {title}
            {unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="error" />
            )}
          </Box>
        }
        action={
          unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={onMarkAllRead}
            >
              Mark all read
            </Button>
          )
        }
      />
      <CardContent sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {alerts.length === 0 ? (
          <Box display="flex" alignItems="center" justifyContent="center" p={4}>
            <Typography color="textSecondary">No alerts</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {alerts.map((alert, index) => (
              <React.Fragment key={alert.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    bgcolor: alert.is_read ? 'transparent' : 'action.hover',
                    flexDirection: 'column',
                    alignItems: 'stretch'
                  }}
                >
                  <Box display="flex" alignItems="flex-start" width="100%">
                    <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                      {getAlertIcon(alert.type, alert.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="body2"
                            fontWeight={alert.is_read ? 400 : 600}
                          >
                            {alert.title}
                          </Typography>
                          <Chip
                            label={alert.severity}
                            size="small"
                            color={getSeverityColor(alert.severity)}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="textSecondary">
                          {formatDate(alert.createdAt || alert.created_at)}
                        </Typography>
                      }
                    />
                    <IconButton
                      size="small"
                      onClick={() => toggleExpand(alert.id)}
                    >
                      {expanded[alert.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={expanded[alert.id]}>
                    <Box pl={5} pr={2} pb={1}>
                      <Typography variant="body2" color="textSecondary" paragraph>
                        {alert.message}
                      </Typography>
                      <Box display="flex" gap={1}>
                        {!alert.is_read && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onMarkRead(alert.id)}
                          >
                            Mark Read
                          </Button>
                        )}
                        {!alert.resolved && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => onResolve(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Collapse>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;
