import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { supabase } from '../lib/supabase';
import { WASTE_REASONS, type FoodItem, type WasteEvent } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { formatQty, formatTime, friendlyDbError, newClientId, relativeDay } from '../lib/format';

export default function LogWastePage() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [recent, setRecent] = useState<WasteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<string>('Quality issue');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [itemsRes, wasteRes] = await Promise.all([
      supabase.from('food_items').select('*').eq('is_active', true).order('name'),
      supabase.from('waste_events').select('*').order('wasted_at', { ascending: false }).limit(10),
    ]);
    if (itemsRes.error) setError(friendlyDbError(itemsRes.error.message));
    else if (wasteRes.error) setError(friendlyDbError(wasteRes.error.message));
    else {
      setItems((itemsRes.data ?? []) as FoodItem[]);
      setRecent((wasteRes.data ?? []) as WasteEvent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!itemId) {
      setFormError('Please choose an item.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Quantity must be greater than zero.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const { error: err } = await supabase.from('waste_events').insert({
      item_id: itemId,
      quantity: qty,
      reason,
      note: note.trim() ? note.trim() : null,
      client_id: newClientId(),
    });
    setSaving(false);
    if (err) {
      setFormError(friendlyDbError(err.message));
      return;
    }
    setQuantity('');
    setNote('');
    setToast('Waste recorded');
    void load();
  };

  const selectedItem = items.find((i) => i.id === itemId);

  const reasonColor = (r: string): 'error' | 'warning' | 'default' => {
    if (r === 'Burnt' || r === 'Damaged' || r === 'Dropped') return 'error';
    if (r === 'Expired' || r === 'Quality issue') return 'warning';
    return 'default';
  };

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto', pb: 10 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Log waste
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Record anything thrown away so stock counts stay honest.
      </Typography>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        <Box component="form" onSubmit={onSubmit} noValidate>
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
              <MenuItem key={i.id} value={i.id}>{i.name}</MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={`Quantity${selectedItem ? ` (${selectedItem.unit})` : ''}`}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              fullWidth
              margin="normal"
              required
              inputProps={{ min: 0, step: 'any' }}
              placeholder="e.g. 2"
            />
            <TextField
              select
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              margin="normal"
              required
            >
              {WASTE_REASONS.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            maxRows={3}
            inputProps={{ maxLength: 300 }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={saving || items.length === 0}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineIcon />}
            sx={{ mt: 2 }}
          >
            {saving ? 'Recording…' : 'Record waste'}
          </Button>
        </Box>
      </Paper>

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 4, mb: 1 }}>
        Recent waste
      </Typography>
      {loading && <PageLoader />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && recent.length === 0 && (
        <EmptyState title="No waste recorded" description="Waste entries you log will appear here." />
      )}
      {recent.length > 0 && (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden' }}>
          {recent.map((w) => {
            const item = items.find((i) => i.id === w.item_id);
            return (
              <ListItem
                key={w.id}
                secondaryAction={
                  <Chip label={w.reason} size="small" color={reasonColor(w.reason)} variant="outlined" />
                }
                sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <ListItemText
                  primary={`${formatQty(w.quantity)} ${item?.unit ?? ''} · ${item?.name ?? 'Item'}`}
                  secondary={`${relativeDay(w.wasted_at)} ${formatTime(w.wasted_at)}`}
                  slotProps={{ primary: { fontWeight: 500 } }}
                />
              </ListItem>
            );
          })}
        </List>
      )}

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
