'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulerApi } from '@/lib/api';
import { Clock, Save, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { SchedulerStatus } from '@/lib/types';

const TIMEZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Bangkok',
    'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Africa/Johannesburg', 'Africa/Nairobi',
];

export default function SchedulerPage() {
    const [reportTime, setReportTime] = useState<string | null>(null);
    const [timezone, setTimezone] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const queryClient = useQueryClient();

    const { data: status } = useQuery<SchedulerStatus>({
        queryKey: ['scheduler-status'],
        queryFn: () => schedulerApi.getStatus().then(r => r.data),
    });

    const currentReportTime = reportTime ?? status?.reportTime ?? '07:00';
    const currentTimezone = timezone ?? status?.timezone ?? 'UTC';

    const saveMutation = useMutation({
        mutationFn: () => schedulerApi.updateSchedule(currentReportTime, currentTimezone),
        onSuccess: () => {
            toast.success('Schedule updated successfully');
            queryClient.invalidateQueries({ queryKey: ['scheduler-status'] });
            queryClient.invalidateQueries({ queryKey: ['auth-me'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
        onError: () => toast.error('Failed to update schedule'),
    });

    const nextRun = useMemo(() => {
        try {
            const now = new Date();
            const [h, m] = currentReportTime.split(':').map(Number);
            const next = new Date();
            next.setHours(h, m, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            return next.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'N/A';
        }
    }, [currentReportTime]);

    return (
        <div>
            <div className="page-header">
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Report Scheduler</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Configure when daily reports are automatically generated and emailed
                </p>
            </div>

            <div className="page-content">
                <div className="split-layout">
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '28px' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Schedule Configuration</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} style={{ color: '#60a5fa' }} />
                                    Daily Report Time
                                </label>
                                <div className="inline-field-row">
                                    <input
                                        type="time"
                                        className="input-field"
                                        value={currentReportTime}
                                        onChange={e => setReportTime(e.target.value)}
                                        style={{ maxWidth: '180px' }}
                                    />
                                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                        Report generates daily at this time
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Globe size={14} style={{ color: '#60a5fa' }} />
                                    Timezone
                                </label>
                                <select
                                    className="input-field"
                                    value={currentTimezone}
                                    onChange={e => setTimezone(e.target.value)}
                                    style={{ maxWidth: '320px' }}
                                >
                                    {TIMEZONES.map(tz => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{
                                background: 'rgba(59,130,246,0.06)',
                                border: '1px solid rgba(59,130,246,0.15)',
                                borderRadius: '10px',
                                padding: '14px 16px',
                            }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>NEXT SCHEDULED RUN</div>
                                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    {nextRun}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {currentTimezone}
                                </div>
                            </div>

                            <div>
                                <button
                                    onClick={() => saveMutation.mutate()}
                                    className="btn-primary"
                                    disabled={saveMutation.isPending}
                                    style={{ minWidth: '160px' }}
                                >
                                    <Save size={14} />
                                    {saveMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Schedule'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="side-panel-stack">
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
                            <div style={{ fontWeight: '700', marginBottom: '14px', fontSize: '14px' }}>How It Works</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { step: '1', title: 'Data Fetch', desc: 'Market data pulled from the configured provider for all active assets' },
                                    { step: '2', title: 'Analysis', desc: 'Technical indicators (RSI, MACD, EMA, Bollinger, ATR) calculated' },
                                    { step: '3', title: 'Charts', desc: 'Candlestick charts with overlays generated for each asset' },
                                    { step: '4', title: 'Commentary', desc: 'Institutional-grade analysis text generated automatically' },
                                    { step: '5', title: 'PDF Build', desc: 'Branded multi-page PDF report assembled' },
                                    { step: '6', title: 'Email', desc: 'PDF emailed to all active subscribers automatically' },
                                ].map(item => (
                                    <div key={item.step} style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                                            color: '#60a5fa', fontSize: '12px', fontWeight: '700',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>{item.step}</div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{item.title}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(245,158,11,0.06)',
                            border: '1px solid rgba(245,158,11,0.15)',
                            borderRadius: '12px', padding: '16px',
                        }}>
                            <div style={{ fontWeight: '600', color: '#f59e0b', marginBottom: '8px', fontSize: '13px' }}>
                                Generate Now
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Don&apos;t wait for the schedule - generate a report immediately
                            </div>
                            <a href="/reports">
                                <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}>
                                    Go to Reports {'->'}
                                </button>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
