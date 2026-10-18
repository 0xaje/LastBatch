import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { supabase } from '../lib/supabase';
import type { ActivityEntry, Batch, Replenishment, WasteEvent } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/States';
import { formatDateTime, friendlyDbError } from '../lib/format';

type Range = 'today' | '7d' | '30d';

interface Totals {
  produced: number;
  replenished: number;
  wasted: number;
  wasteByReason: Record<string, number>;
}

export default function HistoryPage() {
  const [range, setRange] = useState<Range>('7d');
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [replenishments, setReplenishments] = useState<Replenishment[]>([]);
  const [waste, setWaste] = useState<WasteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    if (range === 'today') d.setHours(0, 0, 0, 0);
    else if (range === '7d') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [actRes, batchRes, replRes, wasteRes] = await Promise.all([
      supabase.from('activity_log').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
      supabase.from('batches').select('*').gte('produced_at', since),
      supabase.from('replenishments').select('*').gte('recorded_at', since),
      supabase.from('waste_events').select('*').gte('wasted_at', since),
    ]);
    if (actRes.error || batchRes.error || replRes.error || wasteRes.error) {
      setError(friendlyDbError(actRes.error?.message || batchRes.error?.message || replRes.error?.message || wasteRes.error?.message || ''));
    } else {
      setActivity((actRes.data ?? []) as ActivityEntry[]);
      setBatches((batchRes.data ?? []) as Batch[]);
      setReplenishments((replRes.data ?? []) as Replenishment[]);
      setWaste((wasteRes.data ?? []) as WasteEvent[]);
    }
    setLoading(false);
  }, [since]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals: Totals = useMemo(() => {
    const produced = batches.reduce((s, b) => s + Number(b.quantity), 0);
    const replenished = replenishments.reduce((s, r) => s + Number(r.quantity), 0);
    const wasted = waste.reduce((s, w) => s + Number(w.quantity), 0);
    const wasteByReason: Record<string, number> = {};
    for (const w of waste) {
      wasteByReason[w.reason] = (wasteByReason[w.reason] ?? 0) + Number(w.quantity);
    }
    return { produced, replenished, wasted, wasteByReason };
  }, [batches, replenishments, waste]);

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <Box sx={{ p: 2, maxWidth: 640, mx: 'auto' }}>
        <ErrorState message={error} onRetry={() => void load()} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 640, mx: 'auto', pb: 10 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        History and reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Every number here is summed directly from recorded production, replenishment and waste records for the selected period. Sales are not shown because quantity sold can only be known after a shift is counted and closed — see the shift closeouts for that.
      </Typography>

      <ToggleButtonGroup
        value={range}
        exclusive
        onChange={(_, v) => v && setRange(v)}
        fullWidth
        size="small"
        sx={{ mb: 3 }}
      >
        <ToggleButton value="today">Today</ToggleButton>
        <ToggleButton value="7d">Last 7 days</ToggleButton>
        <ToggleButton value="30d">Last 30 days</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
        <ReportCard label="Produced" value={totals.produced} />
        <ReportCard label="Replenished" value={totals.replenished} />
        <ReportCard label="Wasted" value={totals.wasted} tone="error" />
        <ReportCard label="Waste entries" value={waste.length} />
      </Box>

      {Object.keys(totals.wasteByReason).length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Waste by reason
          </Typography>
          {Object.entries(totals.wasteByReason)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, qty]) => (
              <Box key={reason} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2">{reason}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                  {qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                </Typography>
              </Box>
            ))}
        </Paper>
      )}

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Activity
      </Typography>
      {activity.length === 0 ? (
        <EmptyState title="No activity yet" description="Records from batches, waste, shifts and handovers will appear here." />
      ) : (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, overflow: 'hidden' }}>
          {activity.map((a, idx) => (
            <Box
              key={a.id}
              sx={{
                display: 'flex',
                gap: 2,
                px: 2.5,
                py: 1.75,
                borderBottom: idx < activity.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                {idx < activity.length - 1 && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', mt: 0.5 }} />}
              </Box>
              <Box sx={{ flex: 1, pb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {a.summary}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(a.created_at)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}

function ReportCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'error' }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color: tone === 'error' ? 'error.main' : tone === 'success' ? 'success.main' : 'text.primary' }}>
        {value.toLocaleString(undefined, { maximumFractionDigits: 3 })}
      </Typography>
    </Paper>
  );
}
