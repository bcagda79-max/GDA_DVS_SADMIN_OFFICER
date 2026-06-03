"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { AuthFeedback } from "@/components/ui/auth-feedback";
import { BarChart3, Clock3, FileText, ShieldCheck, UserCheck, ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { LoadingState } from "@/components/ui/loading-state";

type DashboardMetrics = {
  totalOfficers: number;
  pendingRequests: number;
  totalDocuments: number;
  totalLogins: number;
};

type PendingOfficer = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  designation: string;
  department: string;
  role: "admin" | "officer";
  confirmed: boolean;
  approved: boolean;
  created_at: string;
};

type DocumentHistoryItem = {
  id: string;
  title: string;
  department: string;
  recipient_name: string | null;
  processed_by: string | null;
  created_at: string;
  officerName: string;
};

type LoginHistoryItem = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  login_status: string;
  ip_address: string | null;
  browser: string | null;
  operating_system: string | null;
  device_type: string | null;
  created_at: string;
  officerName: string;
};

type MonthlyMetric = {
  label: string;
  value: number;
};

type DashboardResponse = {
  metrics: DashboardMetrics;
  pendingOfficers: PendingOfficer[];
  documentHistory: DocumentHistoryItem[];
  loginHistory: LoginHistoryItem[];
  documentsMonthly?: MonthlyMetric[];
  loginsMonthly?: MonthlyMetric[];
};

export default function AdminPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [selectedLogin, setSelectedLogin] = useState<LoginHistoryItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Imperative tooltip element to avoid re-rendering the page on mousemove
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.pointerEvents = "none";
    el.style.zIndex = "9999";
    el.style.top = "0px";
    el.style.left = "0px";
    el.style.transform = "translate(-9999px, -9999px)";
    el.style.transition = "transform 0.08s, opacity 0.08s";
    el.style.opacity = "0";
    const inner = document.createElement("div");
    inner.className = "rounded-xl bg-[rgba(2,6,23,0.95)] border border-[rgba(56,189,248,0.2)] text-white px-3 py-1.5 text-xs dmsans shadow-[0_8px_24px_rgba(0,0,0,0.5)]";
    inner.style.whiteSpace = "nowrap";
    el.appendChild(inner);
    document.body.appendChild(el);
    tooltipRef.current = el;
    return () => {
      try {
        document.body.removeChild(el);
      } catch (e) { }
      tooltipRef.current = null;
    };
  }, []);

  function showTooltip(x: number, y: number, content: string) {
    const el = tooltipRef.current;
    if (!el) return;
    const inner = el.firstChild as HTMLElement;
    inner.textContent = content;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = "translate(0, -100%)";
    el.style.opacity = "1";
  }

  function hideTooltip() {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.transform = "translate(-9999px, -9999px)";
    el.style.opacity = "0";
  }

  useEffect(() => {
    const timer = feedback ? window.setTimeout(() => setFeedback(null), 5000) : null;
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [feedback]);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;

        if (!user) {
          router.replace("/signin");
          return;
        }

        const res = await fetch(`/api/access/context?userId=${user.id}`);
        const context = await res.json();

        if (!context?.isAdmin) {
          router.replace(context?.canGenerate ? "/generate" : "/pending");
          return;
        }

        setAdminUserId(user.id);

        const dashboardRes = await fetch(`/api/admin/dashboard?userId=${user.id}`);
        const dashboard = await dashboardRes.json();

        if (!dashboardRes.ok) {
          throw new Error(dashboard?.error ?? "Failed to load admin dashboard.");
        }

        // limit recent items to 6 for home view
        if (dashboard?.pendingOfficers) dashboard.pendingOfficers = dashboard.pendingOfficers.slice(0, 6);
        if (dashboard?.documentHistory) dashboard.documentHistory = dashboard.documentHistory.slice(0, 6);
        if (dashboard?.loginHistory) dashboard.loginHistory = dashboard.loginHistory.slice(0, 6);

        setData(dashboard);
        setSelectedLogin(dashboard.loginHistory?.[0] ?? null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load admin dashboard.";
        setFeedback({ type: "error", message });
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  const metrics = data?.metrics ?? {
    totalOfficers: 0,
    pendingRequests: 0,
    totalDocuments: 0,
    totalLogins: 0,
  };

  const quickStats = useMemo(
    () => [
      { label: "Total Officers", value: metrics.totalOfficers, icon: UserCheck },
      { label: "Pending Requests", value: metrics.pendingRequests, icon: Clock3 },
      { label: "Barcodes Generated", value: metrics.totalDocuments, icon: FileText },
      { label: "Login Events", value: metrics.totalLogins, icon: BarChart3 },
    ],
    [metrics],
  );

  function renderDeltaBadge(delta?: number) {
    if (delta === undefined || delta === 0) return null;
    const up = delta > 0;
    return (
      <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${up ? "bg-[rgba(52,211,153,0.12)] text-emerald-400 border border-[rgba(52,211,153,0.15)]" : "bg-[rgba(239,68,68,0.1)] text-red-400 border border-[rgba(239,68,68,0.12)]"}`}>
        {up ? "▲" : "▼"} {Math.abs(delta)}%
      </span>
    );
  }

  function formatNumber(n: number) {
    return new Intl.NumberFormat("en-US").format(n);
  }

  // helper: last 12 months labels and ranges
  function last12Months() {
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({ label: d.toLocaleString("en-US", { month: "short" }), start, end });
    }
    return months;
  }

  // derive series from API data for charts or fallback to history arrays
  function buildSeriesFromHistory(history: any[] | undefined, dateKey = "created_at") {
    const months = last12Months();
    const counts = months.map((m) => 0);
    if (!history || history.length === 0) return { series: counts, labels: months.map((m) => m.label) };
    history.forEach((item) => {
      const dt = new Date(item[dateKey]);
      for (let i = 0; i < months.length; i++) {
        if (dt >= months[i].start && dt < months[i].end) {
          counts[i] = counts[i] + 1;
          break;
        }
      }
    });
    return { series: counts, labels: months.map((m) => m.label) };
  }

  const apiDocuments = data?.documentsMonthly ?? [];
  const apiLogins = data?.loginsMonthly ?? [];

  const { series: fallbackDocumentsSeries, labels: fallbackDocumentsLabels } = buildSeriesFromHistory(data?.documentHistory, "created_at");
  const { series: fallbackLoginsSeries, labels: fallbackLoginsLabels } = buildSeriesFromHistory(data?.loginHistory, "created_at");

  const documentsSeries = (apiDocuments.length ? apiDocuments.map((m) => m.value) : fallbackDocumentsSeries) ?? [];
  const documentsLabels = (apiDocuments.length ? apiDocuments.map((m) => m.label) : fallbackDocumentsLabels) ?? [];
  const loginsSeries = (apiLogins.length ? apiLogins.map((m) => m.value) : fallbackLoginsSeries) ?? [];
  const loginsLabels = (apiLogins.length ? apiLogins.map((m) => m.label) : fallbackLoginsLabels) ?? [];

  function computeDelta(series: number[]) {
    if (series.length < 2) return 0;
    const last = series[series.length - 1];
    const prev = series[series.length - 2] || 0;
    if (prev === 0) return last === 0 ? 0 : 100;
    return Math.round(((last - prev) / prev) * 100);
  }

  const docsDelta = computeDelta(documentsSeries);
  const loginsDelta = computeDelta(loginsSeries);

  // Small sparkline generator based on the metric value
  function Sparkline({ value }: { value: number }) {
    const points = (() => {
      const base = Math.max(1, value || 1);
      const arr = [0.6, 0.8, 1, 1.15, 0.95].map((m, i) => Math.max(1, Math.round(base * m + i)));
      const max = Math.max(...arr);
      return arr.map((v, i) => `${(i / (arr.length - 1)) * 100},${100 - (v / max) * 60}`);
    })();

    return (
      <svg viewBox="0 0 100 30" className="h-6 w-20" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
          points={points.join(" ")}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Area chart for monthly documents
  function AreaChart({ series, labels }: { series: number[]; labels: string[] }) {
    const width = 720;
    const height = 260;
    const max = Math.max(...series, 1);

    const points = series.map((v, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - (v / max) * (height - 30) - 10;
      return `${x},${y}`;
    });

    const areaPath = `M0,${height} L${points.join(" L ")} L${width},${height} Z`;
    const linePath = `M${points.join(" L ")}`;

    return (
      <div className="rounded-2xl border border-[rgba(56,189,248,0.1)] bg-[rgba(15,23,42,0.85)] backdrop-blur-sm p-4 shadow-[0_12px_50px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#38bdf8] dmsans">Registry Activity</p>
            <h3 className="mt-2 playfair text-lg font-bold text-white">Documents Generated — Last 12 months</h3>
          </div>
          <div className="dmsans text-sm text-white/35 font-light">Total: <span className="font-bold text-[#38bdf8]">{series.reduce((a, b) => a + b, 0)}</span></div>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64"
          onMouseMove={(e: any) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const mx = e.clientX - rect.left;
            // find nearest by x
            let nearest = 0;
            let nearestDist = Infinity;
            points.forEach((p, i) => {
              const x = Number(p.split(",")[0]);
              const d = Math.abs(x - mx);
              if (d < nearestDist) {
                nearestDist = d;
                nearest = i;
              }
            });
            const label = labels[nearest];
            const val = series[nearest];
            showTooltip(e.clientX + 8, rect.top + Number(points[nearest].split(",")[1]), `${label}: ${formatNumber(val)}`);
          }}
          onMouseLeave={() => hideTooltip()}
        >
          <defs>
            <linearGradient id="gda-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#gda-area)" />
          <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* X axis labels */}
          {labels.map((lbl, i) => (
            <text key={lbl} x={(i / (labels.length - 1)) * width} y={height - 2} fontSize={10} fill="rgba(255,255,255,0.2)" textAnchor="middle">{lbl}</text>
          ))}
        </svg>
      </div>
    );
  }

  // Radial KPI chart (animated)
  function RadialChart({ value, max, label }: { value: number; max: number; label: string }) {
    const radius = 64;
    const stroke = 12;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
    const offset = circumference * (1 - pct / 100);

    return (
      <div className="flex items-center gap-4">
        <svg width={160} height={160} viewBox="0 0 160 160" role="img" aria-label={`${label} ${value}`}>
          <defs>
            <linearGradient id="radial-grad" x1="0" x2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
            </linearGradient>
            <filter id="soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#38bdf8" floodOpacity="0.08" />
            </filter>
          </defs>
          <g transform="translate(80,80)">
            <circle r={radius} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <circle r={radius} fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            <motion.circle
              r={radius}
              fill="transparent"
              stroke="url(#radial-grad)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              style={{ filter: "url(#soft-shadow)", transform: "rotate(-90deg)" as any }}
            />
            <text x={0} y={6} textAnchor="middle" fontSize={22} fontWeight={700} fill="white">{formatNumber(value)}</text>
            <text x={0} y={28} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.4)">{label}</text>
            <text x={0} y={46} textAnchor="middle" fontSize={12} fill={docsDelta >= 0 ? "#38bdf8" : "#F87171"}>{docsDelta >= 0 ? `+${docsDelta}% MoM` : `${docsDelta}% MoM`}</text>
          </g>
        </svg>
      </div>
    );
  }

  // Rotating 3D line chart (simple 3D illusion)
  function Rotating3DLine({ series, labels }: { series: number[]; labels: string[] }) {
    const width = 560;
    const height = 160;
    const max = Math.max(...series, 1);
    const points = series.map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * width;
      const y = height - (v / max) * (height - 20) - 10;
      return `${x},${y}`;
    });
    const linePath = `M${points.join(" L ")}`;

    return (
      <motion.div whileHover={{ rotateY: -12 }} className="transform-gpu" style={{ perspective: 900 }}>
        <motion.svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 rounded-lg"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          role="img"
          aria-label="Login activity chart"
          onMouseMove={(e: any) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const mx = e.clientX - rect.left;
            // find nearest point by x
            let nearest = 0;
            let nearestDist = Infinity;
            points.forEach((p, i) => {
              const x = Number(p.split(",")[0]);
              const d = Math.abs(x - mx);
              if (d < nearestDist) {
                nearestDist = d;
                nearest = i;
              }
            });
            const [px, py] = points[nearest].split(",").map(Number);
            showTooltip(e.clientX + 8, rect.top + py, `${labels[nearest] ?? ""}: ${formatNumber(series[nearest])}`);
          }}
          onMouseLeave={() => hideTooltip()}
        >
          <defs>
            <linearGradient id="line-grad" x1="0" x2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#1e40af" stopOpacity="1" />
            </linearGradient>
            <filter id="g-blur"><feGaussianBlur stdDeviation="8" /></filter>
          </defs>
          <g transform="translate(0,0)">
            <path d={linePath} fill="none" stroke="rgba(56,189,248,0.06)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" transform="translate(0,8)" />
            <path d={linePath} fill="none" stroke="url(#line-grad)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {series.map((v, i) => {
              const [x, y] = points[i].split(",").map(Number);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={4} fill="#38bdf8" stroke="rgba(56,189,248,0.3)" strokeWidth={1} />
                </g>
              );
            })}
          </g>
        </motion.svg>
      </motion.div>
    );
  }

  // Simple 3D column chart (bars with skewed faces)
  function Column3D({ series, labels }: { series: number[]; labels: string[] }) {
    const max = Math.max(...series, 1);
    const width = 360;
    const height = 140;
    const barWidth = Math.max(12, Math.floor(width / Math.max(1, series.length) - 6));

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
        <defs>
          <linearGradient id="col-grad" x1="0" x2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
            <stop offset="100%" stopColor="#1e40af" stopOpacity="1" />
          </linearGradient>
        </defs>
        {series.map((v, i) => {
          const bw = barWidth;
          const gap = 6;
          const x = i * (bw + gap) + 6;
          const h = Math.max(4, Math.round((v / max) * (height - 30)));
          const y = height - h - 10;
          return (
            <g
              key={i}
              transform={`translate(${x},${y})`}
              onMouseMove={(e: any) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                showTooltip(e.clientX + 8, e.clientY - 16, `${labels[i] ?? ""}: ${formatNumber(v)}`);
              }}
              onMouseLeave={() => hideTooltip()}
            >
              <rect x={0} y={0} width={bw} height={h} fill="url(#col-grad)" rx={6} />
              <polygon points={`0,0 ${bw},0 ${bw - 6},-6 -6,-6`} fill="rgba(255,255,255,0.06)" />
              <text x={bw / 2} y={-6} fontSize={10} textAnchor="middle" fill="rgba(255,255,255,0.4)">{formatNumber(v)}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  async function approveOfficer(officerId: string) {
    if (!adminUserId) {
      return;
    }

    try {
      const response = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officerId, adminUserId }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to approve officer.");
      }

      setFeedback({ type: "success", message: "Officer approved successfully." });
      const refresh = await fetch(`/api/admin/dashboard?userId=${adminUserId}`);
      const updated = await refresh.json();
      setData(updated);
      setSelectedLogin(updated.loginHistory?.[0] ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve officer.";
      setFeedback({ type: "error", message });
    }
  }

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  if (loading) {
    return <LoadingState title="Loading" subtitle="Fetching Data..." />;
  }

  return (
    <>
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
      `}</style>

      <div className="bg-transparent px-3 sm:px-5 lg:px-8 pb-12 pt-4 perspective-1000 w-full overflow-x-hidden">
        <motion.div
          className="mx-auto max-w-7xl space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Floating tooltip is rendered imperatively to document.body to avoid re-renders */}
          {/* Large activity chart moved to bottom */}

          <AuthFeedback
            message={feedback?.message ?? null}
            type={feedback?.type ?? "error"}
            onClose={() => setFeedback(null)}
          />

          {/* Quick Stats */}
          <motion.div variants={containerVariants} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 preserve-3d">
            {quickStats.map((stat) => {
              const Icon = stat.icon;
              const delta = stat.label === "Barcodes Generated" ? docsDelta : stat.label === "Login Events" ? loginsDelta : undefined;
              return (
                <motion.div
                  key={stat.label}
                  variants={itemVariants}
                  whileHover={{ y: -5, rotateX: 5, rotateY: 2, scale: 1.02 }}
                  className="relative rounded-2xl border border-[rgba(56,189,248,0.1)] bg-[rgba(15,23,42,0.85)] backdrop-blur-sm p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.45)] hover:border-[rgba(56,189,248,0.2)] overflow-hidden transition-shadow duration-300"
                >
                  <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-[rgba(56,189,248,0.04)]" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-white/30 dmsans">{stat.label}</p>
                        <div className="mt-1 flex items-center gap-3">
                          <p className="playfair text-3xl sm:text-4xl font-bold text-[#38bdf8]">{stat.value}</p>
                          {delta !== undefined ? (
                            <motion.span
                              whileHover={{ y: -1, scale: 1.04 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="ml-2 inline-flex items-center gap-1 rounded-full border border-[rgba(56,189,248,0.2)] bg-[#38bdf8] px-2.5 py-0.5 text-[10px] font-semibold text-[#020617] shadow-[0_6px_16px_rgba(56,189,248,0.18)]"
                            >
                              <span className="transition-transform duration-300 group-hover:translate-y-[-1px]">
                                {delta > 0 ? "▲" : "▼"}
                              </span>
                              <span>{Math.abs(delta)}%</span>
                            </motion.span>
                          ) : null}
                        </div>
                      </div>
                      <div className="opacity-80 hidden sm:block">
                        <Sparkline value={Number(stat.value)} />
                      </div>
                    </div>
                    </div>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="grid gap-8 xl:grid-cols-3">
            {/* Radial KPI Chart */}
            <motion.section variants={itemVariants} className="rounded-2xl border border-[rgba(56,189,248,0.1)] bg-[rgba(15,23,42,0.85)] backdrop-blur-sm p-6 shadow-[0_12px_50px_rgba(0,0,0,0.35)] w-full text-center preserve-3d">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#38bdf8] dmsans">KPI Overview</p>
              <h3 className="mt-2 playfair text-lg font-bold text-white">System Health</h3>
              <div className="mt-4 flex items-center justify-center">
                <RadialChart value={metrics.totalDocuments} max={Math.max(100, metrics.totalDocuments, metrics.totalOfficers)} label="Barcodes" />
                <div className="ml-6 text-left">
                  <p className="text-sm text-white/40 dmsans">Total Officers</p>
                  <p className="font-bold text-2xl text-[#38bdf8]">{metrics.totalOfficers}</p>
                  <p className="mt-2 text-xs text-white/30 dmsans mt-2">Pending: {metrics.pendingRequests}</p>
                </div>
              </div>
            </motion.section>

            {/* Rotating 3D Line Chart */}
            <motion.section variants={itemVariants} className="rounded-2xl border border-[rgba(56,189,248,0.1)] bg-[rgba(15,23,42,0.85)] backdrop-blur-sm p-6 shadow-[0_12px_50px_rgba(0,0,0,0.35)] w-full preserve-3d">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#38bdf8] dmsans">Activity</p>
              <h3 className="mt-2 playfair text-lg font-bold text-white">Login Activity (12 months)</h3>
              <div className="mt-4 will-change-transform">
                <Rotating3DLine
                  series={loginsSeries}
                  labels={loginsLabels}
                />
              </div>
            </motion.section>

            {/* Column Chart */}
            <motion.section variants={itemVariants} className="rounded-2xl border border-[rgba(56,189,248,0.1)] bg-[rgba(15,23,42,0.85)] backdrop-blur-sm p-6 shadow-[0_12px_50px_rgba(0,0,0,0.35)] w-full preserve-3d">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#38bdf8] dmsans">Throughput</p>
              <h3 className="mt-2 playfair text-lg font-bold text-white">Monthly Documents</h3>
              <div className="mt-4">
                <Column3D series={documentsSeries} labels={documentsLabels} />
              </div>
            </motion.section>
          </div>
          {/* Moved area chart to bottom so main KPIs are visible first */}
          {documentsSeries && documentsSeries.length > 0 && (
            <motion.div variants={itemVariants}>
              <AreaChart series={documentsSeries} labels={documentsLabels} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
}
