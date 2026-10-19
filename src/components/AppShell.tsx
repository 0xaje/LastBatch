import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import HomeIcon from '@mui/icons-material/Home';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import ThemeToggle from './ThemeToggle';
import DashboardPage from '../pages/DashboardPage';
import LogWastePage from '../pages/LogWastePage';
import ItemsPage from '../pages/ItemsPage';
import HistoryPage from '../pages/HistoryPage';
import ShiftPage from '../pages/ShiftPage';
import BatchDetailPage from '../pages/BatchDetailPage';
import StaffPage from '../pages/StaffPage';

const NAV = [
  { to: '/', label: 'Home', icon: <HomeIcon /> },
  { to: '/log-waste', label: 'Waste', icon: <DeleteOutlineIcon /> },
  { to: '/items', label: 'Items', icon: <Inventory2OutlinedIcon /> },
  { to: '/history', label: 'History', icon: <HistoryIcon /> },
];

export default function AppShell() {
  const { staff, workspace, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  if (!staff || !workspace) return null;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', pb: 9 }}>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <BakeryDiningIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'text.primary', fontWeight: 700 }}>
            {workspace.name}
          </Typography>
          <ThemeToggle />
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} size="small" aria-label="Account menu">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 13 }}>
              {initials(staff.full_name)}
            </Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">{staff.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {staff.email}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  size="small"
                  label={staff.role === 'manager' ? 'Manager' : 'Staff'}
                  color={staff.role === 'manager' ? 'primary' : 'default'}
                  sx={{ height: 22, fontSize: 12 }}
                />
              </Box>
            </Box>
            {staff.role === 'manager' && (
              <MenuItem onClick={() => { setMenuAnchor(null); navigate('/staff'); }}>
                <ListItemIcon><QrCode2Icon fontSize="small" /></ListItemIcon>
                Staff and settings
              </MenuItem>
            )}
            <MenuItem onClick={() => { setMenuAnchor(null); void signOut(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/log-waste" element={<LogWastePage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/shift" element={<ShiftPage />} />
        <Route path="/batches/:batchId" element={<BatchDetailPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }}>
        <BottomNavigation value={false} showLabels>
          {NAV.map((n) => (
            <BottomNavigationAction
              key={n.to}
              component={NavLink}
              to={n.to}
              label={n.label}
              icon={n.icon}
              sx={{ '&.active': { color: 'primary.main' } }}
            />
          ))}
        </BottomNavigation>
      </Box>
    </Box>
  );
}
