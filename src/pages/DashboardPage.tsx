import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Batch, FoodItem } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { formatQty, formatTime, friendlyDbError, newClientId, relativeDay } from '../lib/format';

export default function DashboardPage() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
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
    const [itemsRes, batchesRes] = await Promise.all([
      supabase.from('food_items').select('*').eq('is_active', true).order('name'),
      supabase
        .from('batches')
        .select('*')
        .order('produced_at', { ascending: false })
        .limit(15),
    ]);
    if (itemsRes.error) {
      setError(friendlyDbError(itemsRes.error.message));
    } else if (batchesRes.error) {
      setError(friendlyDbError(batchesRes.error.message));
    } else {
      setItems((itemsRes.data ?? []) as FoodItem[]);
      setBatches((batchesRes.data ?? []) as Batch[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDialog = () => {
    setItemId(items[0]?.id ?? '');
    setQuantity('');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setProducedAt(now.toISOString().slice(0, 16));
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

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Hi {staff?.full_name.split(' ')[0]}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        What did you just bake?
      </Typography>

      <Button
        fullWidth
        variant="contained"
        size="large"
        startIcon={<AddTaskIcon />}
        onClick={openDialog}
        disabled={items.length === 0 && !loading}
        sx={{ mb: 1, py: 1.5, borderRadius: 3 }}
      >
        Log a production batch
      </Button>
      <Button
        fullWidth
        variant="outlined"
        size="large"
        onClick={() => navigate('/shift')}
        sx={{ mb: 3, py: 1.5, borderRadius: 3 }}
      >
        Shift & handover
      </Button>

      {items.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Add items to your catalogue first — then you can log batches against them.
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
          />
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
