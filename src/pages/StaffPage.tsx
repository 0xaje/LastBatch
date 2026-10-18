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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import MenuItemMUI from '@mui/material/MenuItem';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { StaffMember } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { friendlyDbError, initials } from '../lib/format';

interface InvitationRow {
  id: string;
  code: string;
  target_email: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  expired: boolean;
}

export default function StaffPage() {
  const { staff: me, workspace } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteHours, setInviteHours] = useState('72');
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isManager = me?.role === 'manager';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: teamData, error: teamErr }, { data: invData, error: invErr }] = await Promise.all([
      supabase.from('staff').select('*').order('created_at'),
      supabase
        .from('workspace_invitations')
        .select('id, code, target_email, status, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    if (teamErr) setError(friendlyDbError(teamErr.message));
    else setTeam((teamData ?? []) as StaffMember[]);
    if (!invErr && invData) {
      const now = Date.now();
      setInvitations(
        (invData as Omit<InvitationRow, 'expired'>[]).map((inv) => ({
          ...inv,
          expired: new Date(inv.expires_at).getTime() < now,
        })),
      );
    }
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

  const onInvite = async () => {
    setSubmitting(true);
    const hours = Number(inviteHours);
    const { data, error: err } = await supabase.rpc('create_invitation', {
      p_workspace_id: workspace?.id,
      p_target_email: inviteEmail.trim() === '' ? null : inviteEmail.trim().toLowerCase(),
      p_hours: Number.isFinite(hours) ? hours : 72,
    });
    setSubmitting(false);
    if (err) {
      setToast(friendlyDbError(err.message));
      return;
    }
    setLastCode(typeof data === 'string' ? data : null);
    setInviteOpen(false);
    setInviteEmail('');
    setToast('Invitation created — share the code with your new team member');
    void load();
  };

  const onRevoke = async (inv: InvitationRow) => {
    const { error: err } = await supabase.rpc('revoke_invitation', { p_invitation_id: inv.id });
    if (err) {
      setToast(friendlyDbError(err.message));
      return;
    }
    setToast('Invitation revoked');
    void load();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast('Code copied');
    } catch {
      setToast('Could not copy — clipboard unavailable');
    }
  };

  const statusChip = (s: string, expired: boolean) => {
    if (s === 'pending') {
      if (expired) {
        return <Chip label="Expired" size="small" color="default" variant="outlined" />;
      }
      return <Chip label="Pending" size="small" color="warning" variant="outlined" />;
    }
    if (s === 'used') return <Chip label="Used" size="small" color="success" variant="outlined" />;
    return <Chip label="Revoked" size="small" color="default" variant="outlined" />;
  };

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Staff &amp; settings
      </Typography>
      {workspace && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {workspace.name} · {team.length} member{team.length === 1 ? '' : 's'}
        </Typography>
      )}
      {isManager && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Managers can invite staff, change roles and close shifts. Staff can record batches, waste, replenishments and acknowledge handovers.
        </Typography>
      )}

      {loading && <PageLoader />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && (
        <>
          {isManager && (
            <Button variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={() => setInviteOpen(true)} sx={{ mb: 3 }}>
              Invite staff
            </Button>
          )}

          {isManager && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'transparent' }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                How staff join
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create an invitation, share the one-time code with your team member, and they enter it on their setup screen after signing up. Each code works once, optionally only for one email address, and expires automatically.
              </Typography>
            </Paper>
          )}

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

          <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => {
            const emails = team.map((t) => `${t.full_name} <${t.email}>`).join(', ');
            navigator.clipboard.writeText(emails).then(
              () => setToast('Team member details copied'),
              () => setToast('Could not copy — clipboard unavailable'),
            );
          }}>
            Copy team details
          </Button>

          {isManager && invitations.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Recent invitations
              </Typography>
              <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden' }}>
                {invitations.map((inv) => (
                  <ListItem
                    key={inv.id}
                    secondaryAction={
                      inv.status === 'pending' && !inv.expired ? (
                        <Button size="small" color="error" onClick={() => void onRevoke(inv)}>
                          Revoke
                        </Button>
                      ) : undefined
                    }
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" component="code" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {inv.code.slice(0, 6)}…{inv.code.slice(-4)}
                        </Typography>
                        {statusChip(inv.status, inv.expired)}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {inv.target_email ? `For ${inv.target_email} · ` : 'Open code · '}
                        {inv.status === 'pending' && inv.expired
                          ? `Expired ${new Date(inv.expires_at).toLocaleString()}`
                          : `Expires ${new Date(inv.expires_at).toLocaleString()}`}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Invite a staff member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            They sign up with their own account, enter the code on their setup screen, and join {workspace?.name ?? 'your bakery'} as staff.
          </Typography>
          <TextField
            label="Their email (optional)"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="e.g. sam@bakery.com"
            helperText="If set, only this email address can use the code."
          />
          <TextField
            select
            label="Valid for"
            value={inviteHours}
            onChange={(e) => setInviteHours(e.target.value)}
            fullWidth
            margin="normal"
          >
            <MenuItemMUI value="24">24 hours</MenuItemMUI>
            <MenuItemMUI value="72">3 days</MenuItemMUI>
            <MenuItemMUI value="168">7 days</MenuItemMUI>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={submitting} onClick={() => void onInvite()}>
            {submitting ? 'Creating…' : 'Create invitation'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(lastCode)} onClose={() => setLastCode(null)} fullWidth maxWidth="xs">
        <DialogTitle>Share this invitation code</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Anyone with this code can join {workspace?.name ?? 'your bakery'} as staff (until it expires or is revoked). Keep it private.
          </Typography>
          <TextField
            value={lastCode ?? ''}
            fullWidth
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }}
            onFocus={(e) => e.target.select()}
          />
        </DialogContent>
        <DialogActions>
          <Button startIcon={<ContentCopyIcon />} onClick={() => lastCode && void copyCode(lastCode)}>
            Copy code
          </Button>
          <Button variant="contained" onClick={() => setLastCode(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

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
