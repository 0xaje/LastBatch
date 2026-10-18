import { useCallback, useEffect, useState } from 'react';
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
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ForumIcon from '@mui/icons-material/Forum';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { CountRow, HandoverAcknowledgment, HandoverNote, Shift, ShiftCloseout } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { formatDateTime, formatQty, friendlyDbError } from '../lib/format';

export default function ShiftPage() {
  const { staff } = useAuth();
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [notes, setNotes] = useState<(HandoverNote & { acks: HandoverAcknowledgment[] })[]>([]);
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [closeOpen, setCloseOpen] = useState(false);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [closeError, setCloseError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [shiftsRes, teamRes, notesRes] = await Promise.all([
      supabase.from('shifts').select('*').order('opened_at', { ascending: false }),
      supabase.from('staff').select('id, full_name'),
      supabase.from('handover_notes').select('*, acks:handover_acknowledgments(*)').order('created_at', { ascending: false }).limit(5),
    ]);
    if (shiftsRes.error) setError(friendlyDbError(shiftsRes.error.message));
    else if (notesRes.error) setError(friendlyDbError(notesRes.error.message));
    else {
      const all = (shiftsRes.data ?? []) as Shift[];
      setOpenShift(all.find((s) => s.status === 'open') ?? null);
      setPastShifts(all.filter((s) => s.status === 'closed'));
      setTeam((teamRes.data ?? []) as { id: string; full_name: string }[]);
      setNotes((notesRes.data ?? []) as (HandoverNote & { acks: HandoverAcknowledgment[] })[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onOpenShift = async () => {
    setBusy(true);
    const { error: err } = await supabase.rpc('open_shift');
    setBusy(false);
    if (err) {
      setToast(friendlyDbError(err.message));
      return;
    }
    setToast('Shift opened');
    void load();
  };

  const startClose = async () => {
    if (!openShift) return;
    setCloseError(null);
    setBusy(true);

    const openedAt = new Date(openShift.opened_at).toISOString();
    const [itemsRes, batchesRes, replRes, wasteRes] = await Promise.all([
      supabase.from('food_items').select('*').order('name'),
      supabase.from('batches').select('item_id, quantity, produced_at').gte('produced_at', openedAt),
      supabase.from('replenishments').select('item_id, quantity, recorded_at').gte('recorded_at', openedAt),
      supabase.from('waste_events').select('item_id, quantity, wasted_at').gte('wasted_at', openedAt),
    ]);

    setBusy(false);
    if (itemsRes.error || batchesRes.error || replRes.error || wasteRes.error) {
      setCloseError(friendlyDbError(itemsRes.error?.message || batchesRes.error?.message || replRes.error?.message || wasteRes.error?.message || ''));
      return;
    }

    const items = (itemsRes.data ?? []) as { id: string; name: string; unit: string; is_active: boolean }[];
    const producedMap = new Map<string, number>();
    for (const b of (batchesRes.data ?? []) as { item_id: string; quantity: number }[]) {
      producedMap.set(b.item_id, (producedMap.get(b.item_id) ?? 0) + Number(b.quantity));
    }
    const replMap = new Map<string, number>();
    for (const r of (replRes.data ?? []) as { item_id: string; quantity: number }[]) {
      replMap.set(r.item_id, (replMap.get(r.item_id) ?? 0) + Number(r.quantity));
    }
    const wasteMap = new Map<string, number>();
    for (const w of (wasteRes.data ?? []) as { item_id: string; quantity: number }[]) {
      wasteMap.set(w.item_id, (wasteMap.get(w.item_id) ?? 0) + Number(w.quantity));
    }

    const rows: CountRow[] = items
      .filter((i) => i.is_active || (producedMap.get(i.id) ?? 0) > 0 || (replMap.get(i.id) ?? 0) > 0 || (wasteMap.get(i.id) ?? 0) > 0)
      .map((i) => {
      const produced = producedMap.get(i.id) ?? 0;
      const replenished = replMap.get(i.id) ?? 0;
      const wasted = wasteMap.get(i.id) ?? 0;
      return {
        item_id: i.id,
        name: i.name,
        unit: i.unit,
        produced,
        replenished,
        wasted,
        expected: produced + replenished - wasted,
        remaining: '',
        explanation: '',
        inactive: !i.is_active,
      };
    });
    setCounts(rows);
    setCloseOpen(true);
  };

  const onClose = async () => {
    if (!openShift) return;
    const handover = (document.getElementById('handover-message') as HTMLTextAreaElement | null)?.value.trim() ?? '';
    if (handover.length === 0) {
      setCloseError('Please write a handover note before closing the shift.');
      return;
    }
    for (const c of counts) {
      const rem = Number(c.remaining);
      if (c.remaining === '' || !Number.isFinite(rem) || rem < 0) {
        setCloseError(`Enter the remaining quantity for ${c.name}.`);
        return;
      }
      const diff = c.expected - rem;
      if (diff !== 0 && c.explanation.trim() === '') {
        setCloseError(`Unreconciled difference for ${c.name} — write an explanation.`);
        return;
      }
    }
    setCloseError(null);
    setBusy(true);
    const payload = counts.map((c) => ({
      item_id: c.item_id,
      remaining: Number(c.remaining),
      explanation: c.explanation.trim() || undefined,
    }));
    const { error: err } = await supabase.rpc('close_shift', {
      p_shift: openShift.id,
      p_counts: payload,
      p_handover_message: handover,
    });
    setBusy(false);
    if (err) {
      setCloseError(friendlyDbError(err.message));
      return;
    }
    setCloseOpen(false);
    setToast('Shift closed with handover note');
    void load();
  };

  const onAck = async (noteId: string) => {
    setBusy(true);
    const { error: err } = await supabase.rpc('acknowledge_handover', { p_note: noteId });
    setBusy(false);
    if (err) {
      setToast(friendlyDbError(err.message));
      return;
    }
    setToast('Handover acknowledged');
    void load();
  };

  const lastNote = notes[0];

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto', pb: 10 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Shift and handover
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Open a shift at the start, count what's left at the end, and leave a note for the next person.
      </Typography>

      {loading && <PageLoader />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && (
        <>
          {openShift ? (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Chip icon={<PlayArrowIcon />} label="Shift open" color="success" />
                <Typography variant="caption" color="text.secondary">
                  Opened by {team.find((t) => t.id === openShift.opened_by)?.full_name ?? 'Unknown'}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {formatDateTime(openShift.opened_at)} — everything logged since then will be reconciled at close.
              </Typography>
              <Button fullWidth variant="contained" size="large" onClick={() => void startClose()} disabled={busy}>
                {busy ? 'Preparing…' : 'Close shift and count stock'}
              </Button>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4, mb: 3 }}>
              <Chip label="No shift open" variant="outlined" sx={{ mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Open a shift at the start of work so batches, waste and replenishments are grouped to it.
              </Typography>
              <Button fullWidth variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={() => void onOpenShift()} disabled={busy}>
                {busy ? 'Opening…' : 'Open a shift'}
              </Button>
            </Paper>
          )}

          {lastNote && (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4, mb: 3, bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ForumIcon fontSize="small" sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle2">Latest handover note</Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                {lastNote.message}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                — {team.find((t) => t.id === lastNote.author_id)?.full_name ?? 'Unknown'}, {formatDateTime(lastNote.created_at)}
              </Typography>
              {lastNote.author_id === staff?.id ? (
                <Chip size="small" icon={<TaskAltIcon />} label="Your note" variant="outlined" />
              ) : lastNote.acks.some((a) => a.acknowledged_by === staff?.id) ? (
                <Chip size="small" color="success" icon={<CheckCircleIcon />} label="You acknowledged this" />
              ) : (
                <Button size="small" variant="contained" onClick={() => void onAck(lastNote.id)} disabled={busy}>
                  Acknowledge note
                </Button>
              )}
              {lastNote.acks.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Acknowledged by {lastNote.acks.map((a) => team.find((t) => t.id === a.acknowledged_by)?.full_name ?? 'someone').join(', ')}
                </Typography>
              )}
            </Paper>
          )}

          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Past shifts
          </Typography>
          {pastShifts.length === 0 ? (
            <EmptyState title="No closed shifts yet" description="Once you close a shift, its reconciliation report appears here." />
          ) : (
            <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', py: 0, overflow: 'hidden' }}>
              {pastShifts.slice(0, 8).map((s) => (
                <ShiftRow key={s.id} shift={s} team={team} />
              ))}
            </List>
          )}
        </>
      )}

      <Dialog open={closeOpen} onClose={() => !busy && setCloseOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Close shift — count remaining stock</DialogTitle>
        <DialogContent>
          {closeError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {closeError}
            </Alert>
          )}
          {counts.map((c, idx) => {
            const rem = Number(c.remaining);
            const diff = c.remaining === '' || !Number.isFinite(rem) ? null : c.expected - rem;
            return (
              <Box key={c.item_id} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2">
                    {c.name}
                  </Typography>
                  {c.inactive && <Chip size="small" label="No longer on the menu" variant="outlined" />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Produced {formatQty(c.produced)} · Replenished {formatQty(c.replenished)} · Wasted {formatQty(c.wasted)} — expected on hand: {formatQty(Math.max(c.expected, 0))} {c.unit}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label={`Remaining (${c.unit})`}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ min: 0, step: 'any' }}
                    value={c.remaining}
                    onChange={(e) => {
                      const next = [...counts];
                      next[idx] = { ...c, remaining: e.target.value };
                      setCounts(next);
                    }}
                  />
                  <Chip
                    label={diff === null ? '—' : diff === 0 ? 'Reconciled' : `${diff > 0 ? '+' : ''}${formatQty(diff)} diff`}
                    color={diff === null ? 'default' : diff === 0 ? 'success' : 'warning'}
                    size="small"
                    sx={{ alignSelf: 'center' }}
                  />
                </Box>
                {diff !== null && diff !== 0 && (
                  <TextField
                    label="Explanation for the difference (required)"
                    size="small"
                    fullWidth
                    margin="normal"
                    value={c.explanation}
                    onChange={(e) => {
                      const next = [...counts];
                      next[idx] = { ...c, explanation: e.target.value };
                      setCounts(next);
                    }}
                    inputProps={{ maxLength: 300 }}
                  />
                )}
                <Divider sx={{ mt: 2 }} />
              </Box>
            );
          })}
          <TextField
            id="handover-message"
            label="Handover note for the next shift (required)"
            fullWidth
            multiline
            minRows={3}
            margin="normal"
            inputProps={{ maxLength: 2000 }}
            helperText={`Signed by ${staff?.full_name ?? 'you'} — the next person must acknowledge it`}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCloseOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={() => void onClose()} disabled={busy} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}>
            {busy ? 'Closing…' : 'Close shift'}
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

function ShiftRow({ shift, team }: { shift: Shift; team: { id: string; full_name: string }[] }) {
  const [closeouts, setCloseouts] = useState<ShiftCloseout[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded || closeouts) return;
    (async () => {
      const { data } = await supabase.from('shift_closeouts').select('*').eq('shift_id', shift.id);
      setCloseouts((data ?? []) as ShiftCloseout[]);
    })();
  }, [expanded, closeouts, shift.id]);

  const diffs = closeouts?.filter((c) => c.difference !== 0).length ?? 0;
  const totalUnaccounted = closeouts?.reduce((sum, c) => sum + Number(c.sold_estimate), 0) ?? 0;
  const fullyReconciled = closeouts !== null && diffs === 0;

  return (
    <ListItem
      onClick={() => setExpanded((v) => !v)}
      sx={{ borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }}
    >
      <ListItemText
        primary={`Closed ${formatDateTime(shift.closed_at ?? shift.opened_at)}`}
        secondary={
          closeouts
            ? `Closed by ${team.find((t) => t.id === shift.closed_by)?.full_name ?? 'Unknown'} · Unaccounted for: ${formatQty(totalUnaccounted)} · ${fullyReconciled ? 'all items reconciled' : `${diffs} unreconciled item(s)`}`
            : `Closed by ${team.find((t) => t.id === shift.closed_by)?.full_name ?? 'Unknown'} · Tap to see the closeout report`
        }
        slotProps={{ primary: { fontWeight: 500 } }}
      />
      {expanded && (
        <Box sx={{ mt: 1 }}>
          {closeouts === null && <CircularProgress size={18} />}
          {closeouts?.map((c) => (
            <Box key={c.id} sx={{ mb: 1.5 }}>
              <CloseoutRow closeout={c} />
            </Box>
          ))}
        </Box>
      )}
    </ListItem>
  );
}

function CloseoutRow({ closeout }: { closeout: ShiftCloseout }) {
  const [item, setItem] = useState<{ name: string; unit: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('food_items')
        .select('name, unit')
        .eq('id', closeout.item_id)
        .maybeSingle();
      setItem((data ?? null) as { name: string; unit: string } | null);
    })();
  }, [closeout.item_id]);

  if (!item) return <Typography variant="caption">Loading item…</Typography>;
  const diff = Number(closeout.difference);
  return (
    <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
        <Chip
          size="small"
          label={diff === 0 ? 'Reconciled' : `${diff > 0 ? '+' : ''}${formatQty(diff)}`}
          color={diff === 0 ? 'success' : 'warning'}
          variant={diff === 0 ? 'outlined' : 'filled'}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        Produced {formatQty(closeout.produced)} + Replenished {formatQty(closeout.replenished)} − Wasted {formatQty(closeout.wasted)} → on hand {formatQty(closeout.remaining)} {item.unit}; unaccounted for {formatQty(closeout.sold_estimate)} {item.unit}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Unaccounted = sold or missing, as counted at close. It is not a verified sale.
      </Typography>
      {closeout.explanation && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.main' }}>
          Explanation: {closeout.explanation}
        </Typography>
      )}
    </Box>
  );
}
