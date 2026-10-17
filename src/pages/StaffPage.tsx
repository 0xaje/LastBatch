import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { StaffMember } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { friendlyDbError, initials } from '../lib/format';

export default function StaffPage() {
  const { staff: me } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const isManager = me?.role === 'manager';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from('staff').select('*').order('created_at');
    if (err) setError(friendlyDbError(err.message));
    else setTeam((data ?? []) as StaffMember[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSetRole = async (member: StaffMember, role: 'manager' | 'staff') => {
    setMenuFor(null);
    const { error: err } = await supabase.rpc('set_staff_role', { p_member: member.id, p_role: role });
    if (err) {
      setToast(friendlyDbError(err.message));
      return;
    }
    setToast(`${member.full_name} is now ${role === 'manager' ? 'a manager' : 'staff'}`);
    void load();
  };

  const copyEmails = async () => {
    const emails = team.map((t) => `${t.full_name} <${t.email}>`).join(', ');
    try {
      await navigator.clipboard.writeText(emails);
      setToast('Team member details copied');
    } catch {
      setToast('Could not copy — clipboard unavailable');
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Staff & settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        To add staff, share your workspace name with them: they sign up, tap "Join an existing workspace" and appear here.
      </Typography>

      {loading && <PageLoader />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && (
        <>
          {team.length === 0 ? (
            <EmptyState title="No team members" description="People who join your workspace will show up here." />
          ) : (
            <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden', mb: 2 }}>
              {team.map((m) => (
                <ListItem
                  key={m.id}
                  secondaryAction={
                    isManager && m.id !== me?.id ? (
                      <IconButton
                        edge="end"
                        onClick={() => setMenuFor(m.id)}
                        aria-label="Member actions"
                        data-member-menu={m.id}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    ) : undefined
                  }
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                    <Avatar sx={{ bgcolor: m.role === 'manager' ? 'primary.main' : 'grey.400', width: 40, height: 40, fontSize: 14 }}>
                      {initials(m.full_name)}
                    </Avatar>
                    <ListItemText
                      primary={m.full_name + (m.id === me?.id ? ' (you)' : '')}
                      secondary={m.email}
                      slotProps={{ primary: { fontWeight: 500 } }}
                    />
                  </Box>
                  <Chip
                    label={m.role === 'manager' ? 'Manager' : 'Staff'}
                    size="small"
                    color={m.role === 'manager' ? 'primary' : 'default'}
                    variant={m.role === 'manager' ? 'filled' : 'outlined'}
                    sx={{ ml: 1 }}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => void copyEmails()}>
            Copy team details
          </Button>
        </>
      )}

          <Menu anchorEl={document.body.querySelector(`[data-member-menu="${menuFor ?? ''}"]`)} open={Boolean(menuFor)} onClose={() => setMenuFor(null)}>
        <MenuItem onClick={() => { const m = team.find((t) => t.id === menuFor); if (m) void onSetRole(m, 'manager'); }}>
          Make manager
        </MenuItem>
        <MenuItem onClick={() => { const m = team.find((t) => t.id === menuFor); if (m) void onSetRole(m, 'staff'); }}>
          Set as staff
        </MenuItem>
      </Menu>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
