import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Fab from '@mui/material/Fab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import AddTaskIcon from '@mui/icons-material/AddTask';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ForumIcon from '@mui/icons-material/Forum';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Batch, FoodItem, Shift } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { formatQty, formatTime, friendlyDbError, newClientId, relativeDay } from '../lib/format';

interface LatestNote {
  id: string;
  message: string;
  author_id: string;
  created_at: string;
  acks: { acknowledged_by: string }[];
}

interface Discrepancy {
  item: string;
  qty: number;
  unit: string;
}

export default function DashboardPage() {
  const { staff, workspace } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [note, setNote] = useState<LatestNote | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [producedAt, setProducedAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [itemsRes, batchesRes, shiftsRes, notesRes] = await Promise.all([
      supabase.from('food_items').select('*').eq('is_active', true).order('name'),
      supabase
        .from('batches')
        .select('*')
        .order('produced_at', { ascending: false })
        .limit(15),
      supabase.from('shifts').select('*').order('opened_at', { ascending: false }).limit(1),
      supabase
        .from('handover_notes')
        .select('id, message, author_id, created_at, acks:handover_acknowledgments(acknowledged_by)')
        .order('created_at', { ascending: false })
        .limit(1),
    ]);
    if (itemsRes.error) {
      setError(friendlyDbError(itemsRes.error.message));
    } else if (batchesRes.error) {
      setError(friendlyDbError(batchesRes.error.message));
    } else if (shiftsRes.error) {
      setError(friendlyDbError(shiftsRes.error.message));
    } else if (notesRes.error) {
      setError(friendlyDbError(notesRes.error.message));
    } else {
      setItems((itemsRes.data ?? []) as FoodItem[]);
      setBatches((batchesRes.data ?? []) as Batch[]);
      const shifts = (shiftsRes.data ?? []) as Shift[];
      setOpenShift(shifts.find((s) => s.status === 'open') ?? null);
      const notes = (notesRes.data ?? []) as LatestNote[];
      setNote(notes[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Discrepancies from the most recent closed shift, only when no shift is open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (openShift) {
        setDiscrepancies([]);
        return;
      }
      const { data: latestClosed } = await supabase
        .from('shifts')
        .select('id')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!latestClosed) {
        setDiscrepancies([]);
        return;
      }
      const { data: closeouts, error: coErr } = await supabase
        .from('shift_closeouts')
        .select('item_id, difference')
        .eq('shift_id', latestClosed.id);
      if (cancelled) return;
      if (coErr || !closeouts) {
        setDiscrepancies([]);
        return;
      }
      const diffRows = (closeouts as { item_id: string; difference: number }[]).filter(
        (c) => Number(c.difference) !== 0,
      );
      if (diffRows.length === 0) {
        setDiscrepancies([]);
        return;
      }
      const { data: itemsById } = await supabase
        .from('food_items')
        .select('id, name, unit')
        .in('id', diffRows.map((r) => r.item_id));
      if (cancelled) return;
      setDiscrepancies(
        diffRows.map((r) => {
          const item = (itemsById ?? []).find((i) => i.id === r.item_id);
          return {
            item: item?.name ?? 'Item',
            qty: Number(r.difference),
            unit: item?.unit ?? '',
          };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [openShift]);

  const openDialog = () => {
    setItemId(items[0]?.id ?? '');
    setQuantity('');
    // Keep second precision: close_shift attributes batches by
    // produced_at >= shift.opened_at, and shifts can open mid-minute, so
    // truncating to the minute could default the time before the shift opened.
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setProducedAt(now.toISOString().slice(0, 19));
    setFormError(null);
    setDialogOpen(true);
  };

  const onSave = async () => {
    const qty = Number(quantity);
    if (!itemId) {
      setFormError('Please choose an item.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Quantity must be greater than zero.');
      return;
    }
    if (!producedAt) {
      setFormError('Please choose a time.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const { error: err } = await supabase.from('batches').insert({
      item_id: itemId,
      quantity: qty,
      produced_at: new Date(producedAt).toISOString(),
      client_id: newClientId(),
    });
    setSaving(false);
    if (err) {
      setFormError(friendlyDbError(err.message));
      return;
    }
    setDialogOpen(false);
    setToast('Batch recorded');
    void load();
  };

  const batchesByDay = useMemo(() => {
    const map = new Map<string, Batch[]>();
    for (const b of batches) {
      const key = relativeDay(b.produced_at);
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [batches]);

  const selectedItem = items.find((i) => i.id === itemId);

  const producedAtWarning = useMemo(() => {
    if (!openShift || !producedAt) return null;
    const ts = new Date(producedAt).getTime();
    const opened = new Date(openShift.opened_at).getTime();
    if (ts < opened) {
      return 'This time is before the current shift opened. The batch will not be attributed to this shift at closeout.';
    }
    if (ts > Date.now() + 60_000) {
      return 'This time is in the future. Batches should reflect when production actually happened.';
    }
    return null;
  }, [openShift, producedAt]);

  const pendingAckForMe = Boolean(
    note && note.author_id !== staff?.id && !note.acks.some((a) => a.acknowledged_by === staff?.id),
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto' }}>
      <Typography variant="body2" color="text.secondary">
        {workspace?.name}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        {greeting}, {staff?.full_name.split(' ')[0]}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {openShift ? 'A shift is open.' : 'No shift is open.'}
      </Typography>

      {/* Pending handover acknowledgment */}
      {pendingAckForMe && note && (
        <Alert
          icon={<ForumIcon />}
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" component={RouterLink} to="/shift">
              View
            </Button>
          }
        >
          A handover note is waiting for your acknowledgment.
        </Alert>
      )}

      {/* Unresolved discrepancies from the last closeout */}
      {!loading && !error && discrepancies.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />
            <Typography variant="subtitle2">Unresolved discrepancies from the last closeout</Typography>
          </Box>
          <List disablePadding>
            {discrepancies.map((d, i) => (
              <ListItem key={`${d.item}-${i}`} disableGutters>
                <ListItemText
                  primary={d.item}
                  secondary={`${d.qty > 0 ? '+' : ''}${formatQty(d.qty)} ${d.unit} unaccounted for`.trim()}
                  slotProps={{ primary: { fontWeight: 500 } }}
                />
              </ListItem>
            ))}
          </List>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Recorded at the last shift close. The full report is on the shift page.
          </Typography>
        </Paper>
      )}

      {/* Quick actions */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<AddTaskIcon />}
          onClick={openDialog}
          disabled={items.length === 0 && !loading}
          sx={{ py: 1.5, borderRadius: 3 }}
        >
          Log a batch
        </Button>
        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => navigate('/log-waste')}
          sx={{ py: 1.5, borderRadius: 3 }}
        >
          Log waste
        </Button>
        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<PlayArrowIcon />}
          onClick={() => navigate('/shift')}
          sx={{ py: 1.5, borderRadius: 3, gridColumn: { sm: '1 / -1' } }}
        >
          Shift and handover
        </Button>
      </Box>

      {items.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Add items to your catalogue first, then you can log batches against them.
        </Alert>
      )}

      {loading && <PageLoader />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && batches.length === 0 && (
        <EmptyState
          title="No batches yet"
          description="Batches you record will show up here, newest first."
        />
      )}

      {batchesByDay.map(([day, dayBatches]) => (
        <Box key={day} sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {day}
          </Typography>
          <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden' }}>
            {dayBatches.map((b) => {
              const item = items.find((i) => i.id === b.item_id);
              return (
                <ListItem
                  key={b.id}
                  component={RouterLink}
                  to={`/batches/${b.id}`}
                  secondaryAction={<VisibilityIcon sx={{ color: 'text.disabled', fontSize: 20 }} />}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider', color: 'inherit', textDecoration: 'none' }}
                >
                  <ListItemText
                    primary={item?.name ?? 'Item'}
                    secondary={`Batch of ${formatQty(b.quantity)} ${item?.unit ?? ''} · ${formatTime(b.produced_at)}`}
                    slotProps={{ primary: { fontWeight: 500 } }}
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      ))}

      <Fab color="primary" aria-label="Log batch" onClick={openDialog} sx={{ position: 'fixed', bottom: 84, right: 16 }}>
        <AddIcon />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Log a production batch</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <TextField
            select
            label="Item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            fullWidth
            margin="normal"
            required
          >
            {items.map((i) => (
              <MenuItem key={i.id} value={i.id}>
                {i.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={`Quantity${selectedItem ? ` (${selectedItem.unit})` : ''}`}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
            margin="normal"
            required
            inputProps={{ min: 0, step: 'any' }}
            placeholder="e.g. 24"
          />
          <TextField
            label="Produced at"
            type="datetime-local"
            value={producedAt}
            onChange={(e) => setProducedAt(e.target.value)}
            fullWidth
            margin="normal"
            required
            inputProps={{ step: 1 }}
          />
          {producedAtWarning && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {producedAtWarning}
            </Alert>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Recorded by {staff?.full_name}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={() => void onSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save batch'}
          </Button>
        </DialogActions>
      </Dialog>

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
