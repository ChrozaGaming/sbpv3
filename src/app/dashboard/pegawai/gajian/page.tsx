"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BadgeCheck,
    Banknote,
    Calculator,
    Calendar,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    CircleAlert,
    CircleDollarSign,
    Download,
    FileText,
    Filter,
    HandCoins,
    IdCard,
    Info,
    Minus,
    Pencil,
    Plus,
    Printer,
    Search,
    Trash2,
    TrendingDown,
    TrendingUp,
    User,
    Wallet,
    X,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { printSlipGaji } from "@/lib/print/slip-gaji";

/* ===========================
   Types
   =========================== */

type StatusGaji = "draft" | "disetujui" | "dibayar";
type TipeGaji = "harian" | "mingguan" | "bulanan";
type MetodeBayar = "tunai" | "transfer";

type Penggajian = {
    penggajian_id: string;
    pegawai_id: string;
    kontrak_id?: string | null;
    periode_mulai: string;
    periode_akhir: string;
    tipe_gaji: TipeGaji;
    jumlah_hari_kerja?: number | null;
    upah_per_hari?: number | null;
    upah_pokok: number;
    uang_lembur: number;
    tunjangan_makan: number;
    tunjangan_transport: number;
    tunjangan_lain: number;
    bonus: number;
    total_pendapatan: number;
    potongan_kasbon: number;
    potongan_bpjs: number;
    potongan_pph21: number;
    potongan_lain: number;
    total_potongan: number;
    gaji_bersih: number;
    status_gaji: StatusGaji;
    tanggal_bayar?: string | null;
    metode_bayar?: MetodeBayar | null;
    bukti_bayar_url?: string | null;
    catatan?: string | null;
    created_at: string;
    updated_at: string;
};

type FormState = {
    penggajian_id: string;
    pegawai_id: string;
    kontrak_id: string;
    periode_mulai: string;
    periode_akhir: string;
    tipe_gaji: TipeGaji;
    jumlah_hari_kerja: string;
    upah_per_hari: string;
    upah_pokok: string;
    uang_lembur: string;
    tunjangan_makan: string;
    tunjangan_transport: string;
    tunjangan_lain: string;
    bonus: string;
    potongan_kasbon: string;
    potongan_bpjs: string;
    potongan_pph21: string;
    potongan_lain: string;
    status_gaji: StatusGaji;
    tanggal_bayar: string;
    metode_bayar: MetodeBayar | "";
    bukti_bayar_url: string;
    catatan: string;
};

type MasterPegawaiLite = {
    pegawai_id: string;
    nik?: string;
    nama_lengkap: string;
    status_aktif?: string;
};

type KontrakKerjaLite = {
    kontrak_id: string;
    pegawai_id: string;
    tipe_kontrak: string;
    jabatan: string;
    kategori_pekerja: string;
    mulai_kontrak: string;
    akhir_kontrak?: string | null;
    status_kontrak: string;
    upah_harian_default?: number | null;
    upah_mingguan_default?: number | null;
    upah_bulanan_default?: number | null;
    lokasi_penempatan_default?: string | null;
};

/** Kasbon ringkas — untuk integrasi potongan di slip gaji */
type KasbonLite = {
    kasbon_id: string;
    pegawai_id: string;
    kontrak_id?: string | null;
    tanggal_pengajuan: string;
    nominal_pengajuan: number;
    nominal_disetujui?: number | null;
    alasan?: string | null;
    status_kasbon: string;
    metode_potong: string;
    saldo_kasbon: number;
    tanggal_cair?: string | null;
};

/**
 * Per-kasbon payment line di form penggajian.
 * User centang kasbon mana yang dipotong, pilih lunas/sebagian + input nominal.
 */
type KasbonPaymentLine = {
    kasbon_id: string;
    saldo: number;
    nominal_disetujui: number;
    alasan: string;
    tanggal_pengajuan: string;
    tanggal_cair: string;
    metode_potong: string;
    enabled: boolean;
    mode: "lunas" | "sebagian";
    nominal_bayar: string;
};

/* ===========================
   Constants
   =========================== */

const STATUS_GAJI: StatusGaji[] = ["draft", "disetujui", "dibayar"];
const TIPE_GAJI: TipeGaji[] = ["harian", "mingguan", "bulanan"];
const METODE_BAYAR: MetodeBayar[] = ["tunai", "transfer"];

/* ===========================
   Utilities
   =========================== */

function cn(...xs: Array<string | false | undefined | null>) { return xs.filter(Boolean).join(" "); }

function toIDR(n?: number | null) {
    if (n == null || Number.isNaN(n)) return "-";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d?: string | null) {
    if (!d) return "-";
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return d;
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(dt);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function uuidv4() {
    if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function statusTone(s: StatusGaji) {
    switch (s) {
        case "draft": return "bg-amber-50 text-amber-700 ring-amber-100";
        case "disetujui": return "bg-sky-50 text-sky-700 ring-sky-100";
        case "dibayar": return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        default: return "bg-slate-100 text-slate-700 ring-slate-200";
    }
}

function useDebouncedValue<T>(value: T, delayMs: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => { const t = setTimeout(() => setDebounced(value), delayMs); return () => clearTimeout(t); }, [value, delayMs]);
    return debounced;
}

function num(v: string) { const n = Number(v); return Number.isNaN(n) ? 0 : n; }

function kontrakToTipeGaji(k: KontrakKerjaLite): TipeGaji {
    if (k.upah_harian_default && k.upah_harian_default > 0) return "harian";
    if (k.upah_mingguan_default && k.upah_mingguan_default > 0) return "mingguan";
    if (k.upah_bulanan_default && k.upah_bulanan_default > 0) return "bulanan";
    const t = k.tipe_kontrak;
    if (t === "Harian" || t === "Lepas" || t === "Borongan") return "harian";
    return "bulanan";
}

function kontrakToUpah(k: KontrakKerjaLite, tipe: TipeGaji) {
    if (tipe === "harian") return { upah_per_hari: String(k.upah_harian_default ?? 0), upah_pokok: "0" };
    if (tipe === "mingguan") return { upah_per_hari: "", upah_pokok: String(k.upah_mingguan_default ?? 0) };
    return { upah_per_hari: "", upah_pokok: String(k.upah_bulanan_default ?? 0) };
}

/* ===========================
   API helpers
   =========================== */

function inferApiBase() {
    if (typeof window === "undefined") return "";
    const env = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (env) return env.replace(/\/$/, "");
    return `${window.location.protocol}//${window.location.hostname}:8080`;
}

function inferWsUrl(path: string) {
    if (typeof window === "undefined") return "";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:8080${path}`;
}

async function apiListPegawai(params: { q?: string; limit?: number; signal?: AbortSignal }) {
    const base = inferApiBase(); const url = new URL(`${base}/api/masterpegawai`);
    if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
    url.searchParams.set("limit", String(params.limit ?? 50));
    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch pegawai gagal (${res.status})`);
    const json = await res.json(); return (json?.data ?? json ?? []) as MasterPegawaiLite[];
}

async function apiGetPegawaiById(id: string, signal?: AbortSignal) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/masterpegawai/${id}`, { credentials: "include", signal });
    if (!res.ok) return null; const json = await res.json();
    return (json?.data ?? json ?? null) as MasterPegawaiLite | null;
}

async function apiListKontrakKerja(params: { limit?: number; offset?: number; signal?: AbortSignal }) {
    const base = inferApiBase(); const url = new URL(`${base}/api/kontrakkerja`);
    url.searchParams.set("limit", String(params.limit ?? 500));
    url.searchParams.set("offset", String(params.offset ?? 0));
    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch kontrak gagal (${res.status})`);
    const json = await res.json(); return (json?.data ?? json ?? []) as KontrakKerjaLite[];
}

async function apiListPenggajian(params: { q?: string; limit?: number; offset?: number; signal?: AbortSignal }) {
    const base = inferApiBase(); const url = new URL(`${base}/api/penggajian`);
    if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
    url.searchParams.set("limit", String(params.limit ?? 200));
    url.searchParams.set("offset", String(params.offset ?? 0));
    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch penggajian gagal (${res.status})`);
    const json = await res.json(); return (json?.data ?? json ?? []) as Penggajian[];
}

async function apiCreatePenggajian(payload: any) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/penggajian`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.message ?? `Create gagal (${res.status})`);
    return (json?.data ?? json) as Penggajian;
}

async function apiUpdatePenggajian(id: string, payload: any) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/penggajian/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.message ?? `Update gagal (${res.status})`);
    return (json?.data ?? json) as Penggajian;
}

async function apiDeletePenggajian(id: string) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/penggajian/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.message ?? `Delete gagal (${res.status})`);
    return json;
}

/** Fetch active kasbon for a pegawai (dicairkan + saldo > 0) */
async function apiListKasbon(params: { pegawai_id?: string; status?: string; limit?: number; signal?: AbortSignal }) {
    const base = inferApiBase(); const url = new URL(`${base}/api/kasbon`);
    if (params.pegawai_id) url.searchParams.set("pegawai_id", params.pegawai_id);
    if (params.status) url.searchParams.set("status", params.status);
    url.searchParams.set("limit", String(params.limit ?? 100));
    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch kasbon gagal (${res.status})`);
    const json = await res.json(); return (json?.data ?? json ?? []) as KasbonLite[];
}

/**
 * Create mutasi (payment record) — backend atomically:
 * 1. Inserts into t_kasbon_mutasi
 * 2. Updates saldo_kasbon on t_kasbon
 * 3. Sets status_kasbon = 'lunas' if saldo reaches 0
 */
async function apiCreateMutasi(kasbon_id: string, payload: {
    tipe_mutasi: string; nominal_mutasi: number;
    penggajian_id?: string | null; catatan?: string | null;
}) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kasbon/${kasbon_id}/mutasi`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Create mutasi gagal (${res.status})`);
    return json?.data ?? json;
}

/* ===========================
   PegawaiKontrakSelect
   =========================== */

function PegawaiKontrakSelect({
    value, onChange, cacheById, onCacheUpsert, kontrakByPegawai, disabled, placeholder,
}: {
    value: string;
    onChange: (pegawai_id: string, kontrak: KontrakKerjaLite | null) => void;
    cacheById: Map<string, MasterPegawaiLite>;
    onCacheUpsert: (row: MasterPegawaiLite) => void;
    kontrakByPegawai: Map<string, KontrakKerjaLite[]>;
    disabled?: boolean; placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const debounced = useDebouncedValue(text, 250);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<MasterPegawaiLite[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const reqIdRef = useRef(0);
    const upsertRef = useRef(onCacheUpsert);
    useEffect(() => { upsertRef.current = onCacheUpsert; }, [onCacheUpsert]);

    const selectedLabel = useMemo(() => { if (!value) return ""; return cacheById.get(value)?.nama_lengkap ?? ""; }, [value, cacheById]);

    useEffect(() => { let a = true; const ac = new AbortController(); (async () => { if (!value || cacheById.has(value)) return; const r = await apiGetPegawaiById(value, ac.signal); if (!a) return; if (r?.pegawai_id) upsertRef.current(r); })(); return () => { a = false; ac.abort(); }; }, [value, cacheById]);
    useEffect(() => { function h(e: MouseEvent) { if (!rootRef.current?.contains(e.target as any)) setOpen(false); } document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
    useEffect(() => { if (!open) return; abortRef.current?.abort(); const ac = new AbortController(); abortRef.current = ac; const rid = ++reqIdRef.current; setLoading(true); setErr(null); apiListPegawai({ q: debounced, limit: 50, signal: ac.signal }).then((rows) => { if (ac.signal.aborted || rid !== reqIdRef.current) return; rows.forEach((r) => upsertRef.current(r)); setItems(rows.filter((r) => kontrakByPegawai.has(r.pegawai_id))); }).catch((e) => { if (e?.name === "AbortError" || ac.signal.aborted) return; setErr(e?.message ?? "Gagal"); }).finally(() => { if (rid === reqIdRef.current) setLoading(false); }); return () => { ac.abort(); }; }, [debounced, open, kontrakByPegawai]);

    function bestKontrak(pid: string): KontrakKerjaLite | null {
        const list = kontrakByPegawai.get(pid) ?? [];
        const aktif = list.filter((k) => k.status_kontrak === "aktif");
        const sorted = (aktif.length > 0 ? aktif : list).sort((a, b) => (a.mulai_kontrak < b.mulai_kontrak ? 1 : -1));
        return sorted[0] ?? null;
    }

    function kontrakSummary(pid: string): string {
        const k = bestKontrak(pid); if (!k) return "";
        const w: string[] = [];
        if (k.upah_harian_default && k.upah_harian_default > 0) w.push(`Harian: ${toIDR(k.upah_harian_default)}`);
        if (k.upah_mingguan_default && k.upah_mingguan_default > 0) w.push(`Mingguan: ${toIDR(k.upah_mingguan_default)}`);
        if (k.upah_bulanan_default && k.upah_bulanan_default > 0) w.push(`Bulanan: ${toIDR(k.upah_bulanan_default)}`);
        return `${k.jabatan} • ${k.tipe_kontrak}${w.length ? ` • ${w.join(", ")}` : ""}`;
    }

    return (
        <div ref={rootRef} className="relative">
            <div className="relative">
                <input value={open ? text : selectedLabel || text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => { if (!disabled) setOpen(true); }} disabled={disabled} placeholder={placeholder ?? "Cari pegawai (hanya yang punya kontrak)..."} className={cn("w-full rounded-2xl px-4 py-2.5 pr-10 text-sm ring-1 outline-none focus:ring-4", disabled ? "cursor-not-allowed bg-slate-100 text-slate-500 ring-slate-200" : "bg-slate-50 text-slate-800 ring-slate-200 focus:ring-slate-200/60")} />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {open && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="max-h-80 overflow-y-auto">
                        {err ? <div className="px-4 py-3 text-sm text-rose-700">{err}</div>
                            : items.length === 0 && loading ? <div className="px-4 py-3 text-sm text-slate-600">Memuat...</div>
                                : items.length === 0 ? <div className="px-4 py-3 text-sm text-slate-500">Tidak ada pegawai dengan kontrak aktif.</div>
                                    : items.map((r) => (
                                        <button key={r.pegawai_id} type="button" onClick={() => { upsertRef.current(r); onChange(r.pegawai_id, bestKontrak(r.pegawai_id)); setText(r.nama_lengkap); setOpen(false); }} className={cn("w-full text-left px-4 py-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0", r.pegawai_id === value ? "bg-slate-50" : "bg-white")}>
                                            <div className="text-sm font-semibold text-slate-900">{r.nama_lengkap}</div>
                                            {kontrakSummary(r.pegawai_id) && <div className="mt-0.5 text-xs text-emerald-700 font-medium">{kontrakSummary(r.pegawai_id)}</div>}
                                            <div className="mt-0.5 text-xs text-slate-500">ID: {r.pegawai_id.slice(0, 8)}...{r.nik ? ` • NIK: ${r.nik}` : ""}</div>
                                        </button>
                                    ))}
                    </div>
                    <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Hanya pegawai dengan kontrak kerja</div>
                </div>
            )}
        </div>
    );
}

/* ===========================
   Empty form
   =========================== */

const emptyForm = (): FormState => ({
    penggajian_id: uuidv4(), pegawai_id: "", kontrak_id: "",
    periode_mulai: "", periode_akhir: "", tipe_gaji: "harian",
    jumlah_hari_kerja: "", upah_per_hari: "", upah_pokok: "0",
    uang_lembur: "0", tunjangan_makan: "0", tunjangan_transport: "0",
    tunjangan_lain: "0", bonus: "0", potongan_kasbon: "0",
    potongan_bpjs: "0", potongan_pph21: "0", potongan_lain: "0",
    status_gaji: "draft", tanggal_bayar: "", metode_bayar: "",
    bukti_bayar_url: "", catatan: "",
});

/* ===========================
   Page
   =========================== */

export default function Page() {
    const [open, setOpen] = useState(true);
    const [rows, setRows] = useState<Penggajian[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [rowsError, setRowsError] = useState<string | null>(null);

    const [pegawaiCache, setPegawaiCache] = useState<Map<string, MasterPegawaiLite>>(new Map());
    const upsertPegawaiCache = useCallback((row: MasterPegawaiLite) => { if (!row?.pegawai_id) return; setPegawaiCache((prev) => { const n = new Map(prev); n.set(row.pegawai_id, { ...prev.get(row.pegawai_id), ...row }); return n; }); }, []);

    const [allKontrak, setAllKontrak] = useState<KontrakKerjaLite[]>([]);
    const [kontrakLoading, setKontrakLoading] = useState(false);

    const kontrakByPegawai = useMemo(() => { const m = new Map<string, KontrakKerjaLite[]>(); for (const k of allKontrak) { const l = m.get(k.pegawai_id) ?? []; l.push(k); m.set(k.pegawai_id, l); } return m; }, [allKontrak]);
    const kontrakById = useMemo(() => { const m = new Map<string, KontrakKerjaLite>(); for (const k of allKontrak) m.set(k.kontrak_id, k); return m; }, [allKontrak]);

    const [query, setQuery] = useState("");
    const [fStatus, setFStatus] = useState<StatusGaji | "all">("all");
    const [fTipe, setFTipe] = useState<TipeGaji | "all">("all");

    const PAGE_SIZE = 10;
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    /* --- Kasbon state --- */
    const [kasbonLines, setKasbonLines] = useState<KasbonPaymentLine[]>([]);
    const [kasbonLoading, setKasbonLoading] = useState(false);

    const totalKasbonPotongan = useMemo(() => {
        return kasbonLines.filter((l) => l.enabled).reduce((sum, l) => {
            if (l.mode === "lunas") return sum + l.saldo;
            const n = Number(l.nominal_bayar);
            return sum + (Number.isNaN(n) || n <= 0 ? 0 : Math.min(n, l.saldo));
        }, 0);
    }, [kasbonLines]);

    useEffect(() => { setForm((p) => { const v = String(totalKasbonPotongan); if (p.potongan_kasbon === v) return p; return { ...p, potongan_kasbon: v }; }); }, [totalKasbonPotongan]);

    const activeKontrak = useMemo<KontrakKerjaLite | null>(() => (!form.kontrak_id ? null : kontrakById.get(form.kontrak_id) ?? null), [form.kontrak_id, kontrakById]);

    /* Load data */
    useEffect(() => {
        let alive = true;
        const ac = new AbortController();
        (async () => {
            try {
                setRowsError(null); setLoadingRows(true); setKontrakLoading(true);
                const [pData, kData] = await Promise.all([
                    apiListPenggajian({ limit: 200, offset: 0, signal: ac.signal }),
                    apiListKontrakKerja({ limit: 500, offset: 0, signal: ac.signal }),
                ]);
                if (!alive) return;
                setRows(Array.isArray(pData) ? pData : []);
                setAllKontrak(Array.isArray(kData) ? kData : []);
            } catch (e: any) {
                if (!alive || e?.name === "AbortError") return;
                setRowsError(e?.message ?? "Gagal memuat");
            } finally {
                if (alive) { setLoadingRows(false); setKontrakLoading(false); }
            }
        })();
        return () => { alive = false; ac.abort(); };
    }, []);

    const requestedRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!rows.length) return;
        const ac = new AbortController();
        let alive = true;
        const missing = Array.from(new Set(rows.map((r) => r.pegawai_id).filter(Boolean)))
            .filter((id) => !pegawaiCache.has(id) && !requestedRef.current.has(id))
            .slice(0, 50);
        missing.forEach((id) => requestedRef.current.add(id));
        let idx = 0;
        async function w() {
            while (alive && idx < missing.length) {
                const id = missing[idx++];
                try {
                    const r = await apiGetPegawaiById(id, ac.signal);
                    if (!alive) return;
                    if (r?.pegawai_id) upsertPegawaiCache(r);
                } catch (e: any) {
                    if (e?.name === "AbortError") return;
                    // silent fail for individual pegawai fetch
                }
            }
        }
        (async () => { await Promise.all(Array.from({ length: Math.min(6, missing.length) }, () => w())); })();
        return () => { alive = false; ac.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]);

    /* WS penggajian */
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_PENGGAJIAN_URL || inferWsUrl("/ws/penggajian");
        if (!wsUrl) return;
        let ws: WebSocket | null = null; let alive = true; let retry = 0; let t: any = null;
        function upsert(row: Penggajian) { setRows((p) => { const i = p.findIndex((x) => x.penggajian_id === row.penggajian_id); if (i === -1) return [row, ...p]; const n = [...p]; n[i] = row; return n; }); }
        const sched = () => { if (!alive) return; retry = Math.min(retry + 1, 8); t = setTimeout(conn, Math.min(1200 * retry, 8000)); };
        function conn() { if (!alive) return; if (t) clearTimeout(t); try { ws = new WebSocket(wsUrl); } catch { sched(); return; } ws.onopen = () => { retry = 0; }; ws.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m?.tipe !== "penggajian") return; if (m.event === "created" || m.event === "updated") upsert(m.payload); if (m.event === "deleted") { const id = String(m.payload?.penggajian_id ?? ""); if (id) setRows((p) => p.filter((x) => x.penggajian_id !== id)); } } catch { } }; ws.onclose = () => sched(); ws.onerror = () => { try { ws?.close(); } catch { } }; }
        conn(); return () => { alive = false; if (t) clearTimeout(t); try { ws?.close(); } catch { } };
    }, []);

    /* WS kontrak */
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_KONTRAK_URL || inferWsUrl("/ws/kontrakkerja");
        if (!wsUrl) return;
        let ws: WebSocket | null = null; let alive = true; let retry = 0; let t: any = null;
        function upsert(row: KontrakKerjaLite) { setAllKontrak((p) => { const i = p.findIndex((x) => x.kontrak_id === row.kontrak_id); if (i === -1) return [row, ...p]; const n = [...p]; n[i] = row; return n; }); }
        const sched = () => { if (!alive) return; retry = Math.min(retry + 1, 8); t = setTimeout(conn, Math.min(1200 * retry, 8000)); };
        function conn() { if (!alive) return; if (t) clearTimeout(t); try { ws = new WebSocket(wsUrl); } catch { sched(); return; } ws.onopen = () => { retry = 0; }; ws.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m?.tipe !== "kontrak_kerja") return; if (m.event === "created" || m.event === "updated") upsert(m.payload); if (m.event === "deleted") { const id = String(m.payload?.kontrak_id ?? ""); if (id) setAllKontrak((p) => p.filter((x) => x.kontrak_id !== id)); } } catch { } }; ws.onclose = () => sched(); ws.onerror = () => { try { ws?.close(); } catch { } }; }
        conn(); return () => { alive = false; if (t) clearTimeout(t); try { ws?.close(); } catch { } };
    }, []);

    /* Derived */
    const stats = useMemo(() => {
        const draft = rows.filter((r) => r.status_gaji === "draft").length;
        const dibayar = rows.filter((r) => r.status_gaji === "dibayar").length;
        const totalBruto = rows.filter((r) => r.status_gaji === "dibayar").reduce((s, r) => s + (r.total_pendapatan ?? 0), 0);
        const totalNetto = rows.filter((r) => r.status_gaji === "dibayar").reduce((s, r) => s + (r.gaji_bersih ?? 0), 0);
        return { draft, dibayar, totalBruto, totalNetto };
    }, [rows]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows
            .filter((r) => (fStatus === "all" ? true : r.status_gaji === fStatus))
            .filter((r) => (fTipe === "all" ? true : r.tipe_gaji === fTipe))
            .filter((r) => { if (!q) return true; const p = (pegawaiCache.get(r.pegawai_id)?.nama_lengkap ?? "").toLowerCase(); return [r.penggajian_id, r.pegawai_id, p, r.status_gaji, r.tipe_gaji, r.catatan || ""].join(" ").toLowerCase().includes(q); })
            .sort((a, b) => (a.periode_mulai < b.periode_mulai ? 1 : -1));
    }, [rows, query, fStatus, fTipe, pegawaiCache]);

    useEffect(() => { setPage(1); }, [query, fStatus, fTipe]);
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const startIndex = (clampedPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
    const paged = filtered.slice(startIndex, endIndex);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const computed = useMemo(() => {
        const pendapatan = num(form.upah_pokok) + num(form.uang_lembur) + num(form.tunjangan_makan) + num(form.tunjangan_transport) + num(form.tunjangan_lain) + num(form.bonus);
        const potongan = num(form.potongan_kasbon) + num(form.potongan_bpjs) + num(form.potongan_pph21) + num(form.potongan_lain);
        return { pendapatan, potongan, bersih: pendapatan - potongan };
    }, [form]);

    useEffect(() => {
        if (form.tipe_gaji === "harian" && form.jumlah_hari_kerja && form.upah_per_hari) {
            const calc = num(form.jumlah_hari_kerja) * num(form.upah_per_hari);
            setForm((p) => ({ ...p, upah_pokok: String(calc) }));
        }
    }, [form.tipe_gaji, form.jumlah_hari_kerja, form.upah_per_hari]);

    /* Kasbon fetch */
    async function fetchKasbonForPegawai(pid: string) {
        if (!pid) { setKasbonLines([]); return; }
        setKasbonLoading(true);
        try {
            const all = await apiListKasbon({ pegawai_id: pid, status: "dicairkan", limit: 50 });
            const aktif = all.filter((k) => k.saldo_kasbon > 0);
            setKasbonLines(aktif.map((k) => ({
                kasbon_id: k.kasbon_id, saldo: k.saldo_kasbon,
                nominal_disetujui: k.nominal_disetujui ?? k.nominal_pengajuan,
                alasan: k.alasan ?? "", tanggal_pengajuan: k.tanggal_pengajuan,
                tanggal_cair: k.tanggal_cair ?? "", metode_potong: k.metode_potong,
                enabled: false, mode: "lunas", nominal_bayar: "",
            })));
        } catch (e: any) {
            if (e?.name === "AbortError") return;
            setKasbonLines([]);
        } finally {
            setKasbonLoading(false);
        }
    }

    /* Form helpers */
    function openCreate() { setMode("create"); setFormError(null); setForm(emptyForm()); setKasbonLines([]); setModalOpen(true); }
    function openEdit(row: Penggajian) {
        setMode("edit"); setFormError(null);
        setForm({
            penggajian_id: row.penggajian_id, pegawai_id: row.pegawai_id, kontrak_id: row.kontrak_id || "",
            periode_mulai: row.periode_mulai, periode_akhir: row.periode_akhir, tipe_gaji: row.tipe_gaji,
            jumlah_hari_kerja: row.jumlah_hari_kerja != null ? String(row.jumlah_hari_kerja) : "",
            upah_per_hari: row.upah_per_hari != null ? String(row.upah_per_hari) : "",
            upah_pokok: String(row.upah_pokok), uang_lembur: String(row.uang_lembur),
            tunjangan_makan: String(row.tunjangan_makan), tunjangan_transport: String(row.tunjangan_transport),
            tunjangan_lain: String(row.tunjangan_lain), bonus: String(row.bonus),
            potongan_kasbon: String(row.potongan_kasbon), potongan_bpjs: String(row.potongan_bpjs),
            potongan_pph21: String(row.potongan_pph21), potongan_lain: String(row.potongan_lain),
            status_gaji: row.status_gaji, tanggal_bayar: row.tanggal_bayar || "",
            metode_bayar: row.metode_bayar || "", bukti_bayar_url: row.bukti_bayar_url || "", catatan: row.catatan || "",
        });
        setKasbonLines([]); if (row.pegawai_id) fetchKasbonForPegawai(row.pegawai_id);
        setModalOpen(true);
    }
    function closeModal() { setModalOpen(false); setFormError(null); setKasbonLines([]); }
    function updateForm<K extends keyof FormState>(key: K, val: FormState[K]) { setForm((p) => ({ ...p, [key]: val })); }

    function handlePegawaiSelected(pid: string, kontrak: KontrakKerjaLite | null) {
        if (!kontrak) { setForm((p) => ({ ...p, pegawai_id: pid, kontrak_id: "" })); setKasbonLines([]); return; }
        const tipe = kontrakToTipeGaji(kontrak);
        const upah = kontrakToUpah(kontrak, tipe);
        setForm((p) => ({ ...p, pegawai_id: pid, kontrak_id: kontrak.kontrak_id, tipe_gaji: tipe, upah_per_hari: upah.upah_per_hari, upah_pokok: upah.upah_pokok, jumlah_hari_kerja: p.jumlah_hari_kerja, potongan_kasbon: "0" }));
        fetchKasbonForPegawai(pid);
    }

    /* Kasbon line helpers */
    function toggleKasbonLine(idx: number) { setKasbonLines((p) => p.map((l, i) => i === idx ? { ...l, enabled: !l.enabled } : l)); }
    function setKasbonMode(idx: number, mode: "lunas" | "sebagian") { setKasbonLines((p) => p.map((l, i) => i !== idx ? l : { ...l, mode, nominal_bayar: mode === "lunas" ? String(l.saldo) : l.nominal_bayar })); }
    function setKasbonNominal(idx: number, val: string) { setKasbonLines((p) => p.map((l, i) => i === idx ? { ...l, nominal_bayar: val } : l)); }
    function lineEffective(l: KasbonPaymentLine): number {
        if (!l.enabled) return 0;
        if (l.mode === "lunas") return l.saldo;
        const n = Number(l.nominal_bayar);
        if (Number.isNaN(n) || n <= 0) return 0;
        return Math.min(n, l.saldo);
    }

    /* Validate */
    function validateForm(f: FormState) {
        if (!f.pegawai_id.trim()) return "Pegawai wajib dipilih.";
        if (!f.periode_mulai) return "Periode mulai wajib.";
        if (!f.periode_akhir) return "Periode akhir wajib.";
        if (f.periode_akhir < f.periode_mulai) return "Periode akhir < mulai.";
        if (num(f.upah_pokok) < 0) return "Upah pokok tidak boleh negatif.";
        if (f.status_gaji === "dibayar" && !f.tanggal_bayar) return "Tanggal bayar wajib untuk status dibayar.";
        for (const l of kasbonLines) {
            if (!l.enabled) continue;
            if (l.mode === "sebagian") {
                const n = Number(l.nominal_bayar);
                if (Number.isNaN(n) || n <= 0) return `Kasbon ${l.kasbon_id.slice(0, 8)}...: nominal harus > 0.`;
                if (n > l.saldo) return `Kasbon ${l.kasbon_id.slice(0, 8)}...: nominal melebihi saldo.`;
            }
        }
        return null;
    }

    /* Save */
    async function saveForm() {
        const err = validateForm(form); if (err) { setFormError(err); return; }
        setSaving(true); setFormError(null);
        try {
            const payload: any = {
                penggajian_id: form.penggajian_id, pegawai_id: form.pegawai_id,
                kontrak_id: form.kontrak_id.trim() || null, periode_mulai: form.periode_mulai,
                periode_akhir: form.periode_akhir, tipe_gaji: form.tipe_gaji,
                jumlah_hari_kerja: form.jumlah_hari_kerja ? Number(form.jumlah_hari_kerja) : null,
                upah_per_hari: form.upah_per_hari ? Number(form.upah_per_hari) : null,
                upah_pokok: num(form.upah_pokok), uang_lembur: num(form.uang_lembur),
                tunjangan_makan: num(form.tunjangan_makan), tunjangan_transport: num(form.tunjangan_transport),
                tunjangan_lain: num(form.tunjangan_lain), bonus: num(form.bonus),
                total_pendapatan: computed.pendapatan, potongan_kasbon: num(form.potongan_kasbon),
                potongan_bpjs: num(form.potongan_bpjs), potongan_pph21: num(form.potongan_pph21),
                potongan_lain: num(form.potongan_lain), total_potongan: computed.potongan,
                gaji_bersih: computed.bersih, status_gaji: form.status_gaji,
                tanggal_bayar: form.tanggal_bayar || null, metode_bayar: form.metode_bayar || null,
                bukti_bayar_url: form.bukti_bayar_url.trim() || null, catatan: form.catatan.trim() || null,
            };

            let resultRow: Penggajian;
            if (mode === "create") {
                resultRow = await apiCreatePenggajian(payload);
                setRows((p) => { if (p.some((x) => x.penggajian_id === resultRow.penggajian_id)) return p; return [resultRow, ...p]; });
            } else {
                resultRow = await apiUpdatePenggajian(form.penggajian_id, payload);
                setRows((p) => p.map((x) => (x.penggajian_id === resultRow.penggajian_id ? resultRow : x)));
            }

            const enabledLines = kasbonLines.filter((l) => l.enabled && lineEffective(l) > 0);
            const mutasiErrors: string[] = [];
            for (const line of enabledLines) {
                const bayar = lineEffective(line);
                try {
                    await apiCreateMutasi(line.kasbon_id, {
                        tipe_mutasi: "potong_gaji",
                        nominal_mutasi: bayar,
                        penggajian_id: resultRow.penggajian_id,
                        catatan: `Potongan slip gaji ${resultRow.penggajian_id.slice(0, 8)}... periode ${form.periode_mulai} s/d ${form.periode_akhir}`,
                    });
                } catch (e: any) {
                    mutasiErrors.push(`Kasbon ${line.kasbon_id.slice(0, 8)}: ${e?.message ?? "gagal"}`);
                }
            }

            closeModal();

            const pegName = pegawaiCache.get(resultRow.pegawai_id)?.nama_lengkap ?? "Pegawai";
            let msg = `Slip gaji berhasil ${mode === "create" ? "dibuat" : "diperbarui"}.`;
            if (enabledLines.length > 0) msg += `\n\nKasbon dipotong: ${enabledLines.length} kasbon (${toIDR(totalKasbonPotongan)})`;
            if (mutasiErrors.length > 0) msg += `\n\nPeringatan mutasi:\n${mutasiErrors.join("\n")}`;
            msg += `\n\nCetak slip gaji sekarang?`;

            if (confirm(msg)) { printSlipGaji(resultRow, pegName); }
        } catch (e: any) {
            setFormError(e?.message ?? "Gagal menyimpan");
        } finally {
            setSaving(false);
        }
    }

    async function deleteRow(id: string) { if (!confirm(`Hapus slip gaji ${id}?`)) return; try { await apiDeletePenggajian(id); setRows((p) => p.filter((r) => r.penggajian_id !== id)); } catch (e: any) { alert(e?.message ?? "Gagal"); } }
    async function markPaid(row: Penggajian) { if (!confirm("Tandai sebagai dibayar?")) return; try { const u = await apiUpdatePenggajian(row.penggajian_id, { status_gaji: "dibayar", tanggal_bayar: todayStr(), metode_bayar: "transfer" }); setRows((p) => p.map((x) => (x.penggajian_id === u.penggajian_id ? u : x))); } catch (e: any) { alert(e?.message ?? "Gagal"); } }
    function handlePrint(row: Penggajian) { printSlipGaji(row, pegawaiCache.get(row.pegawai_id)?.nama_lengkap ?? "Pegawai"); }

    function exportCSV() {
        const headers = ["penggajian_id", "pegawai_id", "kontrak_id", "periode_mulai", "periode_akhir", "tipe_gaji", "upah_pokok", "uang_lembur", "tunjangan_makan", "tunjangan_transport", "tunjangan_lain", "bonus", "total_pendapatan", "potongan_kasbon", "potongan_bpjs", "potongan_pph21", "potongan_lain", "total_potongan", "gaji_bersih", "status_gaji", "tanggal_bayar"];
        const csv = [headers.join(","), ...filtered.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replaceAll('"', '""')}"`).join(","))].join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `penggajian_${todayStr()}.csv`; a.click(); URL.revokeObjectURL(url);
    }

    /* ===========================
       Render
       =========================== */
    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 overflow-hidden text-slate-800">
            <div className="shrink-0"><Sidebar open={open} setOpen={setOpen} /></div>
            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-5 md:p-8 max-w-6xl mx-auto w-full">

                        {/* Title */}
                        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm"><Wallet className="h-6 w-6" /></div><div><div className="flex items-center gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><IdCard className="w-3.5 h-3.5" />Dashboard</span><span className="text-slate-300">/</span><span>Pegawai</span><span className="text-slate-300">/</span><span className="text-slate-700 font-medium">Penggajian</span></div><h1 className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">Penggajian / Slip Gaji</h1><p className="mt-1 text-sm text-slate-600">Kalkulasi pendapatan, potongan kasbon, dan pembayaran gaji pekerja.</p></div></div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><button onClick={openCreate} disabled={kontrakLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"><Plus className="h-4 w-4" />Buat Slip Gaji</button><button onClick={exportCSV} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Download className="h-4 w-4" />Export</button></div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Draft" value={stats.draft} icon={<FileText className="w-5 h-5" />} hint="Belum final" />
                            <StatCard title="Sudah Dibayar" value={stats.dibayar} icon={<CheckCircle2 className="w-5 h-5" />} hint="Slip selesai" />
                            <StatCard title="Total Bruto (Dibayar)" value={null} valueStr={toIDR(stats.totalBruto)} icon={<TrendingUp className="w-5 h-5" />} hint="Pendapatan kotor" />
                            <StatCard title="Total Netto (Dibayar)" value={null} valueStr={toIDR(stats.totalNetto)} icon={<Banknote className="w-5 h-5" />} hint="Gaji bersih" />
                        </div>

                        {/* Table */}
                        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 p-4 md:p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="relative w-full lg:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari (ID, nama, catatan...)" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:ring-4 focus:ring-slate-200/60" /></div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="inline-flex items-center gap-2 text-xs text-slate-500"><Filter className="h-4 w-4" />Filter</div><MiniSelect label="Status" value={fStatus} onChange={(v) => setFStatus(v as any)} options={[{ value: "all", label: "Semua" }, ...STATUS_GAJI.map((s) => ({ value: s, label: s }))]} /><MiniSelect label="Tipe" value={fTipe} onChange={(v) => setFTipe(v as any)} options={[{ value: "all", label: "Semua" }, ...TIPE_GAJI.map((t) => ({ value: t, label: t }))]} /></div>
                                </div>
                                {loadingRows && <div className="mt-3 text-xs text-slate-500">Memuat...</div>}
                                {rowsError && <div className="mt-3 text-xs text-rose-700">{rowsError}</div>}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-max min-w-[1400px] text-sm table-auto">
                                    <thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="px-5 py-3 font-semibold whitespace-nowrap">Pegawai</th><th className="px-5 py-3 font-semibold whitespace-nowrap">Periode</th><th className="px-5 py-3 font-semibold whitespace-nowrap">Tipe</th><th className="px-5 py-3 font-semibold whitespace-nowrap">Pendapatan</th><th className="px-5 py-3 font-semibold whitespace-nowrap">Potongan</th><th className="px-5 py-3 font-semibold whitespace-nowrap">Gaji Bersih</th><th className="px-5 py-3 font-semibold whitespace-nowrap">Status</th><th className="px-5 py-3 font-semibold whitespace-nowrap">Tgl Bayar</th><th className="px-5 py-3 font-semibold text-right whitespace-nowrap">Aksi</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paged.length === 0 ? <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-500">Tidak ada data.</td></tr>
                                            : paged.map((r) => {
                                                const pegName = pegawaiCache.get(r.pegawai_id)?.nama_lengkap || "(Memuat...)";
                                                return (
                                                    <tr key={r.penggajian_id} className="hover:bg-slate-50/60 transition">
                                                        <td className="px-5 py-4 align-top whitespace-nowrap"><div className="inline-flex items-center gap-2"><div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200"><User className="h-4 w-4 text-slate-700" /></div><div><div className="font-semibold text-slate-900">{pegName}</div><div className="text-xs text-slate-500">{r.penggajian_id.slice(0, 8)}...</div></div></div></td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap text-slate-800">{formatDate(r.periode_mulai)} <span className="text-slate-400">&rarr;</span> {formatDate(r.periode_akhir)}</td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap"><span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{r.tipe_gaji}</span></td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap"><div className="font-semibold text-emerald-700">{toIDR(r.total_pendapatan)}</div><div className="text-xs text-slate-500">Pokok: {toIDR(r.upah_pokok)}</div></td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap"><div className="font-semibold text-rose-700">{toIDR(r.total_potongan)}</div>{r.potongan_kasbon > 0 && <div className="text-xs text-amber-600">Kasbon: {toIDR(r.potongan_kasbon)}</div>}</td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap"><span className="text-lg font-extrabold text-slate-900">{toIDR(r.gaji_bersih)}</span></td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap"><span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone(r.status_gaji))}>{r.status_gaji}</span></td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap text-slate-700">{formatDate(r.tanggal_bayar)}</td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap"><div className="flex items-center justify-end gap-1.5"><IconButton title="Print Slip" onClick={() => handlePrint(r)}><Printer className="h-4 w-4" /></IconButton>{r.status_gaji !== "dibayar" && <IconButton title="Bayar" onClick={() => markPaid(r)}><Banknote className="h-4 w-4" /></IconButton>}<IconButton title="Edit" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></IconButton><IconButton title="Hapus" danger onClick={() => deleteRow(r.penggajian_id)}><Trash2 className="h-4 w-4" /></IconButton></div></td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between"><div className="text-xs text-slate-500">Menampilkan <span className="font-semibold text-slate-700">{totalItems === 0 ? 0 : startIndex + 1}&ndash;{endIndex}</span> dari <span className="font-semibold text-slate-700">{totalItems}</span></div><div className="inline-flex items-center gap-1"><PagerButton title="First" onClick={() => setPage(1)} disabled={clampedPage === 1}><ChevronsLeft className="h-4 w-4" /></PagerButton><PagerButton title="Prev" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage === 1}><ChevronLeft className="h-4 w-4" /></PagerButton><div className="mx-1 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{clampedPage} / {totalPages}</div><PagerButton title="Next" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage === totalPages}><ChevronRight className="h-4 w-4" /></PagerButton><PagerButton title="Last" onClick={() => setPage(totalPages)} disabled={clampedPage === totalPages}><ChevronsRight className="h-4 w-4" /></PagerButton></div></div>
                        </div>

                        {/* ===== MODAL ===== */}
                        {modalOpen && (
                            <div className="fixed inset-0 z-50">
                                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
                                <div className="absolute inset-0 flex items-end justify-center p-3 sm:items-center sm:p-6">
                                    <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl flex flex-col">
                                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 shrink-0"><div className="flex items-start gap-3"><div className="rounded-2xl bg-slate-900 p-2.5 text-white"><Wallet className="h-5 w-5" /></div><div><div className="text-xs text-slate-500">sbpv3.t_penggajian</div><h2 className="text-base font-bold text-slate-900 sm:text-lg">{mode === "create" ? "Buat Slip Gaji Baru" : "Edit Slip Gaji"}</h2></div></div><button onClick={closeModal} className="rounded-2xl p-2 text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
                                        <div className="p-5 overflow-y-auto flex-1">
                                            {formError && <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-100">{formError}</div>}
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <FieldLabel label="ID (readonly)" icon={<IdCard className="h-4 w-4" />}><input value={form.penggajian_id} readOnly className="w-full cursor-not-allowed rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 outline-none" /></FieldLabel>
                                                <FieldLabel label="Pegawai (dari Kontrak)" icon={<User className="h-4 w-4" />}><PegawaiKontrakSelect value={form.pegawai_id} onChange={handlePegawaiSelected} cacheById={pegawaiCache} onCacheUpsert={upsertPegawaiCache} kontrakByPegawai={kontrakByPegawai} /></FieldLabel>
                                                {activeKontrak && (<div className="md:col-span-2 rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100"><div className="flex items-start gap-2"><Info className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" /><div className="text-xs text-sky-900"><span className="font-bold">Kontrak:</span> {activeKontrak.jabatan} ({activeKontrak.tipe_kontrak}) <div className="mt-1 flex flex-wrap gap-3">{activeKontrak.upah_harian_default != null && activeKontrak.upah_harian_default > 0 && <span className="font-semibold">Harian: {toIDR(activeKontrak.upah_harian_default)}</span>}{activeKontrak.upah_mingguan_default != null && activeKontrak.upah_mingguan_default > 0 && <span className="font-semibold">Mingguan: {toIDR(activeKontrak.upah_mingguan_default)}</span>}{activeKontrak.upah_bulanan_default != null && activeKontrak.upah_bulanan_default > 0 && <span className="font-semibold">Bulanan: {toIDR(activeKontrak.upah_bulanan_default)}</span>}</div></div></div></div>)}
                                                <FieldLabel label="Periode Mulai" icon={<Calendar className="h-4 w-4" />}><input type="date" value={form.periode_mulai} onChange={(e) => updateForm("periode_mulai", e.target.value)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel>
                                                <FieldLabel label="Periode Akhir" icon={<Calendar className="h-4 w-4" />}><input type="date" value={form.periode_akhir} onChange={(e) => updateForm("periode_akhir", e.target.value)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel>
                                                <FieldLabel label="Tipe Gaji" icon={<BadgeCheck className="h-4 w-4" />}><select value={form.tipe_gaji} onChange={(e) => updateForm("tipe_gaji", e.target.value as TipeGaji)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60">{TIPE_GAJI.map((t) => <option key={t} value={t}>{t}</option>)}</select></FieldLabel>
                                                <FieldLabel label="Status" icon={<CircleAlert className="h-4 w-4" />}><select value={form.status_gaji} onChange={(e) => updateForm("status_gaji", e.target.value as StatusGaji)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60">{STATUS_GAJI.map((s) => <option key={s} value={s}>{s}</option>)}</select></FieldLabel>
                                                {form.tipe_gaji === "harian" && (<><FieldLabel label="Jumlah Hari Kerja" icon={<Calendar className="h-4 w-4" />}><input type="number" min={0} value={form.jumlah_hari_kerja} onChange={(e) => updateForm("jumlah_hari_kerja", e.target.value)} placeholder="26" className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel><FieldLabel label="Upah Per Hari" icon={<CircleDollarSign className="h-4 w-4" />}><input type="number" min={0} value={form.upah_per_hari} onChange={(e) => updateForm("upah_per_hari", e.target.value)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /><div className="mt-1 text-[11px] text-slate-500">Auto: {form.jumlah_hari_kerja && form.upah_per_hari ? toIDR(num(form.jumlah_hari_kerja) * num(form.upah_per_hari)) : "-"}</div></FieldLabel></>)}
                                            </div>

                                            {/* Pendapatan */}
                                            <div className="mt-5 rounded-3xl bg-emerald-50/50 p-4 ring-1 ring-emerald-100">
                                                <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-emerald-700" /><span className="text-sm font-bold text-emerald-900">Pendapatan</span><span className="ml-auto text-sm font-extrabold text-emerald-800">{toIDR(computed.pendapatan)}</span></div>
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{([["upah_pokok", "Upah Pokok"], ["uang_lembur", "Lembur"], ["tunjangan_makan", "Tunj. Makan"], ["tunjangan_transport", "Tunj. Transport"], ["tunjangan_lain", "Tunj. Lain"], ["bonus", "Bonus"]] as const).map(([key, label]) => (<div key={key} className="space-y-1"><div className="text-xs font-semibold text-emerald-800">{label}</div><input type="number" min={0} value={(form as any)[key]} onChange={(e) => updateForm(key as any, e.target.value)} className="w-full rounded-2xl bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-emerald-200 outline-none focus:ring-4 focus:ring-emerald-100" /></div>))}</div>
                                            </div>

                                            {/* KASBON AKTIF */}
                                            {form.pegawai_id && (
                                                <div className="mt-4 rounded-3xl bg-amber-50/50 p-4 ring-1 ring-amber-200">
                                                    <div className="flex items-center gap-2 mb-3"><HandCoins className="h-4 w-4 text-amber-700" /><span className="text-sm font-bold text-amber-900">Potongan Kasbon Aktif</span><span className="ml-auto text-sm font-extrabold text-amber-800">{toIDR(totalKasbonPotongan)}</span></div>
                                                    {kasbonLoading ? <div className="text-xs text-amber-700">Memuat kasbon...</div>
                                                        : kasbonLines.length === 0 ? <div className="text-xs text-amber-700/70">Tidak ada kasbon aktif (dicairkan &amp; saldo &gt; 0) untuk pegawai ini.</div>
                                                            : <div className="space-y-3">
                                                                {kasbonLines.map((line, idx) => {
                                                                    const eff = lineEffective(line);
                                                                    return (
                                                                        <div key={line.kasbon_id} className={cn("rounded-2xl p-3 ring-1 transition", line.enabled ? "bg-white ring-amber-300 shadow-sm" : "bg-amber-50/30 ring-amber-100")}>
                                                                            <div className="flex items-start gap-3">
                                                                                <button type="button" onClick={() => toggleKasbonLine(idx)} className={cn("mt-0.5 h-5 w-5 rounded-lg ring-1 flex items-center justify-center shrink-0 transition", line.enabled ? "bg-amber-600 ring-amber-600 text-white" : "bg-white ring-slate-300 text-transparent hover:ring-amber-400")}><Check className="h-3.5 w-3.5" /></button>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-start justify-between gap-2">
                                                                                        <div>
                                                                                            <div className="text-xs font-bold text-slate-900">
                                                                                                Kasbon {line.kasbon_id.slice(0, 8)}...
                                                                                                {line.metode_potong === "potong_gaji" ? <span className="ml-1 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">Potong Gaji</span> : <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-100">Cicilan</span>}
                                                                                            </div>
                                                                                            <div className="mt-0.5 text-[11px] text-slate-500">Disetujui: {toIDR(line.nominal_disetujui)}{line.alasan && <> — {line.alasan}</>}</div>
                                                                                        </div>
                                                                                        <div className="text-right shrink-0"><div className="text-xs text-slate-500">Sisa saldo</div><div className="text-sm font-extrabold text-amber-800">{toIDR(line.saldo)}</div></div>
                                                                                    </div>
                                                                                    {line.enabled && (
                                                                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <button type="button" onClick={() => setKasbonMode(idx, "sebagian")} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition", line.mode === "sebagian" ? "bg-amber-700 text-white ring-amber-700" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>Sebagian (Rp)</button>
                                                                                                <button type="button" onClick={() => setKasbonMode(idx, "lunas")} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition", line.mode === "lunas" ? "bg-emerald-700 text-white ring-emerald-700" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>Lunas ({toIDR(line.saldo)})</button>
                                                                                            </div>
                                                                                            {line.mode === "sebagian" && (
                                                                                                <div className="flex-1 min-w-0">
                                                                                                    <div className="text-[11px] font-semibold text-amber-800 mb-1">Nominal Potong (Rp) — sisa bisa dicicil nanti</div>
                                                                                                    <input type="number" inputMode="numeric" min={0} max={line.saldo} value={line.nominal_bayar} onChange={(e) => setKasbonNominal(idx, e.target.value)} placeholder={`Max ${toIDR(line.saldo)}`} className="w-full rounded-2xl bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-amber-200 outline-none focus:ring-4 focus:ring-amber-100" />
                                                                                                </div>
                                                                                            )}
                                                                                            <div className="shrink-0 text-right">
                                                                                                <div className="text-[11px] text-slate-500">Dipotong</div>
                                                                                                <div className="text-sm font-bold text-rose-700">{toIDR(eff)}</div>
                                                                                                {line.mode === "sebagian" && eff > 0 && <div className="text-[10px] text-slate-500">Sisa: {toIDR(line.saldo - eff)}</div>}
                                                                                                {line.mode === "lunas" && <div className="text-[10px] text-emerald-700 font-semibold">LUNAS</div>}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div className="flex items-center justify-between pt-2 border-t border-amber-200"><div className="text-xs text-amber-800">{kasbonLines.filter((l) => l.enabled).length} dari {kasbonLines.length} kasbon dipilih</div><div className="text-sm font-extrabold text-amber-900">Total: {toIDR(totalKasbonPotongan)}</div></div>
                                                            </div>}
                                                </div>
                                            )}

                                            {/* Potongan */}
                                            <div className="mt-4 rounded-3xl bg-rose-50/50 p-4 ring-1 ring-rose-100">
                                                <div className="flex items-center gap-2 mb-3"><TrendingDown className="h-4 w-4 text-rose-700" /><span className="text-sm font-bold text-rose-900">Potongan</span><span className="ml-auto text-sm font-extrabold text-rose-800">{toIDR(computed.potongan)}</span></div>
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                                    <div className="space-y-1"><div className="text-xs font-semibold text-rose-800">Kasbon{kasbonLines.some((l) => l.enabled) && <span className="ml-1 text-[10px] font-normal text-rose-600">(auto)</span>}</div><input type="number" min={0} value={form.potongan_kasbon} onChange={(e) => { if (!kasbonLines.some((l) => l.enabled)) updateForm("potongan_kasbon", e.target.value); }} readOnly={kasbonLines.some((l) => l.enabled)} className={cn("w-full rounded-2xl px-3 py-2 text-sm ring-1 outline-none", kasbonLines.some((l) => l.enabled) ? "bg-amber-50 text-amber-900 ring-amber-200 cursor-not-allowed font-bold" : "bg-white text-slate-800 ring-rose-200 focus:ring-4 focus:ring-rose-100")} /></div>
                                                    {([["potongan_bpjs", "BPJS"], ["potongan_pph21", "PPh 21"], ["potongan_lain", "Lainnya"]] as const).map(([key, label]) => (<div key={key} className="space-y-1"><div className="text-xs font-semibold text-rose-800">{label}</div><input type="number" min={0} value={(form as any)[key]} onChange={(e) => updateForm(key as any, e.target.value)} className="w-full rounded-2xl bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-rose-200 outline-none focus:ring-4 focus:ring-rose-100" /></div>))}
                                                </div>
                                            </div>

                                            {/* Netto */}
                                            <div className="mt-4 rounded-3xl bg-slate-900 p-4 text-white">
                                                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Calculator className="h-5 w-5" /><span className="text-sm font-bold">Gaji Bersih (Take Home Pay)</span></div><span className="text-2xl font-extrabold">{toIDR(computed.bersih)}</span></div>
                                                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-white/70"><span>Pendapatan: {toIDR(computed.pendapatan)}</span><Minus className="h-3 w-3" /><span>Potongan: {toIDR(computed.potongan)}</span>{totalKasbonPotongan > 0 && <span className="text-amber-300">(kasbon: {toIDR(totalKasbonPotongan)})</span>}</div>
                                            </div>

                                            {/* Pembayaran */}
                                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <FieldLabel label="Tanggal Bayar" icon={<Calendar className="h-4 w-4" />}><input type="date" value={form.tanggal_bayar} onChange={(e) => updateForm("tanggal_bayar", e.target.value)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel>
                                                <FieldLabel label="Metode Bayar" icon={<Banknote className="h-4 w-4" />}><select value={form.metode_bayar} onChange={(e) => updateForm("metode_bayar", e.target.value as MetodeBayar | "")} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"><option value="">-</option>{METODE_BAYAR.map((m) => <option key={m} value={m}>{m}</option>)}</select></FieldLabel>
                                            </div>
                                            <div className="mt-4"><FieldLabel label="Catatan (opsional)" icon={<FileText className="h-4 w-4" />}><textarea value={form.catatan} onChange={(e) => updateForm("catatan", e.target.value)} rows={2} placeholder="Catatan internal..." className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel></div>
                                            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end"><button onClick={closeModal} disabled={saving} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Batal</button><button onClick={saveForm} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">{mode === "create" ? <><Plus className="h-4 w-4" />{saving ? "Menyimpan..." : "Simpan"}</> : <><Pencil className="h-4 w-4" />{saving ? "Mengupdate..." : "Update"}</>}</button></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </main>
                    <Footer />
                </div>
            </div>
        </div>
    );
}

/* ===========================
   UI Components
   =========================== */
function StatCard({ title, value, valueStr, hint, icon }: { title: string; value?: number | null; valueStr?: string; hint: string; icon: React.ReactNode }) { return (<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-slate-500">{title}</div><div className="mt-1 text-2xl font-extrabold text-slate-900">{valueStr ?? value ?? 0}</div><div className="mt-1 text-xs text-slate-500">{hint}</div></div><div className="rounded-2xl bg-slate-50 p-2.5 text-slate-700 ring-1 ring-slate-200">{icon}</div></div></div>); }
function IconButton({ children, title, danger, onClick }: { children: React.ReactNode; title: string; danger?: boolean; onClick?: () => void }) { return <button onClick={onClick} title={title} className={cn("rounded-2xl p-2 ring-1 shadow-sm transition", danger ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>{children}</button>; }
function PagerButton({ children, title, disabled, onClick }: { children: React.ReactNode; title: string; disabled?: boolean; onClick: () => void }) { return <button type="button" title={title} onClick={onClick} disabled={disabled} className={cn("inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold ring-1 transition", disabled ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-slate-200" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>{children}</button>; }
function FieldLabel({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) { return (<div className="space-y-1.5"><div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><span className="text-slate-500">{icon}</span>{label}</div>{children}</div>); }
function MiniSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) { return (<label className="inline-flex items-center gap-2"><span className="text-xs text-slate-500">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none hover:bg-slate-50 focus:ring-4 focus:ring-slate-200/60">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>); }