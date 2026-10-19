import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddLinkIcon from '@mui/icons-material/AddLink';
import { supabase } from '../lib/supabase';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { formatDateTime, formatQty, friendlyDbError, fullNameOf, newClientId, initials } from '../lib/format';
import type { StaffMember } from '../lib/types';
import { Avatar, List, ListItem, ListItemText } from '@mui/material';
import type { Batch, FoodItem, Replenishment } from '../lib/types';

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [item, setItem] = useState<FoodItem | null>(null);
  const [replenishments, setReplenishments] = useState<Replenishment[]>([]);
  const [team, setTeam] = useState<Pick<StaffMember, 'id' | 'full_name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    const [batchRes, teamRes] = await Promise.all([
      supabase.from('batches').select('*').eq('id', batchId).maybeSingle(),
      supabase.from('staff').select('id, full_name'),
    ]);
    if (batchRes.error) {
      setError(friendlyDbError(batchRes.error.message));
      setLoading(false);
      return;
    }
    const b = batchRes.data as Batch | null;
    if (!b) {
      setError('Batch not found.');
      setLoading(false);
      return;
    }
    setBatch(b);
    setTeam((teamRes.data ?? []) as { id: string; full_name: string }[]);

    const [itemRes, replRes] = await Promise.all([
      supabase.from('food_items').select('*').eq('id', b.item_id).maybeSingle(),
      supabase.from('replenishments').select('*').eq('batch_id', batchId).order('recorded_at', { ascending: false }),
    ]);
    if (itemRes.error) setError(friendlyDbError(itemRes.error.message));
    else if (replRes.error) setError(friendlyDbError(replRes.error.message));
    else {
      setItem((itemRes.data ?? null) as FoodItem | null);
      setReplenishments((replRes.data ?? []) as Replenishment[]);
    }
    setLoading(false);
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAddReplenishment = async () => {
    const qty = Number(quantity);
    if (!batch) return;
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Quantity must be greater than zero.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const { error: err } = await supabase.from('replenishments').insert({
      item_id: batch.item_id,
      batch_id: batch.id,
      quantity: qty,
      note: note.trim() ? note.trim() : null,
      client_id: newClientId(),
    });
    setSaving(false);
    if (err) {
      setFormError(friendlyDbError(err.message));
      return;
    }
    setDialogOpen(false);
    setQuantity('');
    setNote('');
    void load();
  };

  if (loading) return <PageLoader />;
  if (error || !batch) {
    return (
      <Box sx={{ p: 2, maxWidth: 640, mx: 'auto' }}>
        <ErrorState message={error ?? 'Batch not found.'} onRetry={() => void load()} />
      </Box>
    );
  }

  const createdBy = fullNameOf(team, batch.created_by);

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        {item?.name ?? 'Batch'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={`Batch of ${formatQty(batch.quantity)} ${item?.unit ?? ''}`} size="small" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }} />
        <Chip label={batch.status === 'open' ? 'Open' : 'Closed'} size="small" variant="outlined" />
      </Box>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontSize: 14 }}>{initials(createdBy)}</Avatar>
          <Box>
            <Typography variant="subtitle2">{createdBy}</Typography>
            <Typography variant="caption" color="text.secondary">
              Produced {formatDateTime(batch.produced_at)}
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddLinkIcon />}
          onClick={() => { setFormError(null); setDialogOpen(true); }}
        >
          Add replenishment to this batch
        </Button>
      </Paper>

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Replenishments linked to this batch
      </Typography>
      {replenishments.length === 0 ? (
        <EmptyState title="No replenishments yet" description="Extras produced on top of this batch will be listed here." />
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden' }}>
          {replenishments.map((r) => (
            <ListItem key={r.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <ListItemText
                primary={`+${formatQty(r.quantity)} ${item?.unit ?? ''}`}
                secondary={`${formatDateTime(r.recorded_at)} · by ${fullNameOf(team, r.created_by)}${r.note ? ` · ${r.note}` : ''}`}
                slotProps={{ primary: { fontWeight: 500 } }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add replenishment</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <TextField
            label={`Quantity (${item?.unit ?? ''})`}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
            margin="normal"
            required
            inputProps={{ min: 0, step: 'any' }}
            autoFocus
          />
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            margin="normal"
            inputProps={{ maxLength: 300 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={() => void onAddReplenishment()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
