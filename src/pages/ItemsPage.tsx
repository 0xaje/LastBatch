import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Snackbar from '@mui/material/Snackbar';
import AddIcon from '@mui/icons-material/Add';
import CircularProgress from '@mui/material/CircularProgress';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { FoodItem } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { friendlyDbError } from '../lib/format';

const UNITS = ['unit', 'kg', 'g', 'L', 'slice', 'box'];
const CATEGORIES = ['Bread', 'Pastry', 'Cake', 'Cookie', 'Drink', 'Other'];

export default function ItemsPage() {
  const { staff } = useAuth();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bread');
  const [unit, setUnit] = useState('unit');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('food_items')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name');
    if (err) {
      setError(friendlyDbError(err.message));
    } else {
      setItems((data ?? []) as FoodItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDialog = () => {
    setName('');
    setCategory('Bread');
    setUnit('unit');
    setFormError(null);
    setDialogOpen(true);
  };

  const onSave = async () => {
    if (name.trim().length === 0) {
      setFormError('Please enter an item name.');
      return;
    }
    if (name.trim().length > 80) {
      setFormError('Name must be 80 characters or fewer.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const { error: err } = await supabase.from('food_items').insert({
      name: name.trim(),
      category,
      unit,
    });
    setSaving(false);
    if (err) {
      setFormError(friendlyDbError(err.message));
      return;
    }
    setDialogOpen(false);
    setToast(`"${name.trim()}" added to the catalogue`);
    void load();
  };

  const onToggleActive = async (item: FoodItem) => {
    const target = !item.is_active;
    const { error: err } = await supabase.rpc('set_item_active', {
      p_item: item.id,
      p_active: target,
    });
    if (err) {
      setToast(friendlyDbError(err.message));
      return;
    }
    setToast(`"${item.name}" ${target ? 'activated' : 'deactivated'}`);
    void load();
  };

  const activeItems = items.filter((i) => i.is_active);
  const inactiveItems = items.filter((i) => !i.is_active);

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Items
        </Typography>
        <Chip
          label={`${activeItems.length} active`}
          size="small"
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
        />
      </Box>

      {loading && <PageLoader />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="No items yet"
          description="Add the things you bake, such as breads, pastries and drinks, so staff can record production and waste against them."
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>
              Add first item
            </Button>
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden' }}>
            {activeItems.map((item) => (
              <ListItem
                key={item.id}
                secondaryAction={
                  staff?.role === 'manager' ? (
                    <Switch edge="end" checked={item.is_active} onChange={() => void onToggleActive(item)} />
                  ) : (
                    <Chip label={item.unit} size="small" variant="outlined" />
                  )
                }
                sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <ListItemText
                  primary={item.name}
                  secondary={`${item.category} · ${item.unit}`}
                  slotProps={{ primary: { fontWeight: 500 } }}
                />
              </ListItem>
            ))}
          </List>

          {inactiveItems.length > 0 && (
            <>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3, mb: 1 }}>
                Inactive, hidden from new records
              </Typography>
              <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden' }}>
                {inactiveItems.map((item) => (
                  <ListItem
                    key={item.id}
                    secondaryAction={
                      staff?.role === 'manager' ? (
                        <Switch edge="end" checked={false} onChange={() => void onToggleActive(item)} />
                      ) : undefined
                    }
                    sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}
                  >
                    <ListItemText
                      primary={item.name}
                      secondary={`${item.category} · ${item.unit}`}
                      slotProps={{ primary: { color: 'text.secondary' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </>
      )}

      <Fab
        color="primary"
        aria-label="Add item"
        onClick={openDialog}
        sx={{ position: 'fixed', bottom: 84, right: 16 }}
      >
        <AddIcon />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add item</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            margin="normal"
            required
            autoFocus
            placeholder="e.g. Sourdough Loaf"
          />
          <TextField
            select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
            margin="normal"
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            fullWidth
            margin="normal"
            helperText="How quantities of this item are counted"
          >
            {UNITS.map((u) => (
              <MenuItem key={u} value={u}>{u}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={() => void onSave()} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {saving ? 'Saving…' : 'Add item'}
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
