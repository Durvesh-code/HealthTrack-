import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, Cell,
  CartesianGrid, Legend
} from 'recharts';
import api from '../../config/api';

/* ─── Theme ─────────────────────────────────────────── */
const TEAL      = '#0f6b6b';
const TEAL_L    = '#148f8f';
const BLUE      = '#2b9af3';
const GREEN     = '#10b981';
const AMBER     = '#f59e0b';
const RED       = '#ef4444';
const SLATE     = '#f4f7f8';

/* ─── Animated counter ──────────────────────────────── */
const Counter = ({ to = 0, duration = 1200 }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const end = parseInt(to, 10) || 0;
    if (end === 0) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setVal(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, to, duration]);

  return <span ref={ref}>{val}</span>;
};

/* ─── Stat card ─────────────────────────────────────── */
const StatCard = ({ label, value, icon, gradient, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg flex flex-col gap-2"
    style={{ background: gradient }}
  >
    {/* background circle decoration */}
    <div
      className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20"
      style={{ background: 'rgba(255,255,255,0.4)' }}
    />
    <div className="text-4xl mb-1">{icon}</div>
    <p className="text-sm font-medium uppercase tracking-widest opacity-80">{label}</p>
    <p className="text-5xl font-bold leading-none">
      <Counter to={value} />
    </p>
  </motion.div>
);

/* ─── Custom area tooltip ────────────────────────────── */
const AreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border-light shadow-md rounded-xl px-4 py-3 text-sm">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      <p style={{ color: TEAL }} className="font-bold">{payload[0].value} appointments</p>
    </div>
  );
};

/* ─── Custom bar tooltip ─────────────────────────────── */
const SymptomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border-light shadow-md rounded-xl px-4 py-3 text-sm">
      <p className="font-semibold text-text-primary">{label}</p>
      <p style={{ color: BLUE }}>{payload[0].value} cases</p>
    </div>
  );
};

/* ─── Main page ─────────────────────────────────────── */
const Statistics = () => {
  const [stats, setStats] = useState({
    summary: { total: 0, completed: 0, pending: 0, cancelled: 0 },
    monthly: [],
    top_symptoms: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/doctor/statistics')
      .then(r => setStats(r.data.stats))
      .catch(err => console.error('Stats error', err))
      .finally(() => setLoading(false));
  }, []);

  const { summary, monthly, top_symptoms } = stats;
  const total = summary.total || 1; // avoid divide-by-zero

  /* completion rate ring data */
  const completionPct = Math.round(((summary.completed || 0) / total) * 100);
  const radialData = [
    { name: 'Completed', value: summary.completed || 0, fill: GREEN },
    { name: 'Pending',   value: summary.pending   || 0, fill: AMBER },
    { name: 'Cancelled', value: summary.cancelled  || 0, fill: RED   },
  ];

  /* symptom bar data — truncate long names */
  const symptomData = (top_symptoms || []).map(s => ({
    symptom: s.symptoms?.length > 22 ? s.symptoms.slice(0, 22) + '…' : (s.symptoms || '?'),
    cases: s.count || 0,
  }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
        <p className="text-warm-gray text-sm">Loading statistics…</p>
      </div>
    );
  }

  return (
    <div className="p-6 w-full space-y-8 animate-fadeInUp">

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            📊 Practice Analytics
          </h1>
          <p className="text-warm-gray mt-1 text-sm">
            Real-time insights into your appointments and patient trends
          </p>
        </div>
        <Link
          to="/doctor/dashboard"
          className="self-start md:self-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-border-light text-deep-teal font-semibold text-sm shadow-sm hover:bg-soft-slate transition"
        >
          ← Dashboard
        </Link>
      </div>

      {/* ── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total"        value={summary.total}
          icon="🗓️"
          gradient={`linear-gradient(135deg, ${TEAL}, ${TEAL_L})`}
          delay={0}
        />
        <StatCard
          label="Completed"    value={summary.completed}
          icon="✅"
          gradient={`linear-gradient(135deg, #059669, #10b981)`}
          delay={0.08}
        />
        <StatCard
          label="Pending"      value={summary.pending}
          icon="⏳"
          gradient={`linear-gradient(135deg, #d97706, #f59e0b)`}
          delay={0.16}
        />
        <StatCard
          label="Cancelled"    value={summary.cancelled}
          icon="❌"
          gradient={`linear-gradient(135deg, #dc2626, #ef4444)`}
          delay={0.24}
        />
      </div>

      {/* ── Main Charts ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Area Chart — Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-md p-6 border border-border-light"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-text-primary text-lg">Monthly Appointment Trend</h2>
              <p className="text-xs text-warm-gray mt-0.5">Appointments over time</p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full text-white"
              style={{ background: TEAL }}
            >
              {monthly.length} months
            </span>
          </div>

          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={TEAL} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ec" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#8a9ba8' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#8a9ba8' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<AreaTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={TEAL}
                  strokeWidth={3}
                  fill="url(#areaGrad)"
                  dot={{ r: 4, fill: TEAL, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: TEAL, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-warm-gray text-sm italic">
              No monthly data available yet.
            </div>
          )}
        </motion.div>

        {/* Radial Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.5 }}
          className="bg-white rounded-2xl shadow-md p-6 border border-border-light flex flex-col"
        >
          <h2 className="font-bold text-text-primary text-lg mb-1">Status Breakdown</h2>
          <p className="text-xs text-warm-gray mb-4">As a % of total</p>

          <div className="flex-1 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="30%" outerRadius="90%"
                barSize={14}
                data={radialData}
                startAngle={90} endAngle={-270}
              >
                <RadialBar
                  background={{ fill: '#f4f7f8' }}
                  dataKey="value"
                  cornerRadius={8}
                />
                <Tooltip
                  formatter={(val, name) => [`${val} (${Math.round((val / total) * 100)}%)`, name]}
                  contentStyle={{ borderRadius: 12, fontSize: 13 }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            {/* centre label */}
            <div className="absolute flex flex-col items-center pointer-events-none">
              <span className="text-3xl font-bold text-text-primary">{completionPct}%</span>
              <span className="text-xs text-warm-gray">done</span>
            </div>
          </div>

          {/* legend */}
          <div className="mt-4 space-y-2">
            {radialData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.fill }} />
                  <span className="text-text-primary font-medium">{d.name}</span>
                </div>
                <span className="text-warm-gray font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Symptoms + completion rate ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Symptom Horizontal Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46, duration: 0.5 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-md p-6 border border-border-light"
        >
          <h2 className="font-bold text-text-primary text-lg mb-1">Top Reported Symptoms</h2>
          <p className="text-xs text-warm-gray mb-5">Based on patient-reported data</p>

          {symptomData.length > 0 ? (
            <ResponsiveContainer width="100%" height={symptomData.length * 52 + 20}>
              <BarChart
                layout="vertical"
                data={symptomData}
                margin={{ top: 0, right: 20, left: 4, bottom: 0 }}
                barCategoryGap="30%"
              >
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={BLUE} />
                    <stop offset="100%" stopColor={TEAL_L} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ec" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#8a9ba8' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="symptom"
                  width={130}
                  tick={{ fontSize: 12, fill: '#1a2e35' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<SymptomTooltip />} />
                <Bar dataKey="cases" fill="url(#barGrad)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-36 text-warm-gray text-sm italic">
              No symptom data recorded yet.
            </div>
          )}
        </motion.div>

        {/* Completion rate summary tile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54, duration: 0.5 }}
          className="bg-white rounded-2xl shadow-md p-6 border border-border-light flex flex-col gap-5"
        >
          <h2 className="font-bold text-text-primary text-lg">Quick Insights</h2>

          {/* SVG ring */}
          <div className="flex justify-center">
            <svg viewBox="0 0 120 120" className="w-32 h-32">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#e1e8ec" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="48"
                fill="none"
                stroke={GREEN}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(completionPct / 100) * 301.6} 301.6`}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dasharray 1.2s ease' }}
              />
              <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1a2e35">
                {completionPct}%
              </text>
              <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#8a9ba8">
                completion
              </text>
            </svg>
          </div>

          <div className="space-y-3">
            {[
              { label: '✅ Completed', val: summary.completed, color: GREEN },
              { label: '⏳ Pending',   val: summary.pending,   color: AMBER },
              { label: '❌ Cancelled', val: summary.cancelled,  color: RED   },
            ].map(({ label, val, color }) => {
              const pct = Math.round(((val || 0) / total) * 100);
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-primary font-medium">{label}</span>
                    <span className="text-warm-gray">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-soft-slate overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: 0.6 }}
                      className="h-full rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-3 border-t border-border-light text-center">
            <p className="text-4xl font-bold text-text-primary">
              <Counter to={summary.total} />
            </p>
            <p className="text-xs text-warm-gray mt-1">Total appointments</p>
          </div>
        </motion.div>
      </div>

    </div>
  );
};

export default Statistics;