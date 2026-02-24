"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BadgeCheck,
    Banknote,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsLeft,
    ChevronsRight,
    CircleAlert,
    CircleDollarSign,
    CircleSlash,
    Clock,
    Download,
    FileText,
    HandCoins,
    History,
    IdCard,
    Info,
    Pencil,
    Plus,
    Printer,
    Search,
    Trash2,
    User,
    Wallet,
    X,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { printSlipKasbon } from "@/lib/print/slip-kasbon";

/* ===========================
   Types
   =========================== */

type StatusKasbon = "diajukan" | "disetujui" | "ditolak" | "dicairkan" | "lunas";
type MetodePencairan = "tunai" | "transfer";
type MetodePotong = "potong_gaji" | "cicilan";
type TableTab = "berjalan" | "lunas";

type Kasbon = {
    kasbon_id: string;
    pegawai_id: string;
    kontrak_id?: string | null;
    tanggal_pengajuan: string;
    nominal_pengajuan: number;
    alasan?: string | null;
    status_kasbon: StatusKasbon;
    disetujui_oleh?: string | null;
    tanggal_persetujuan?: string | null;
    nominal_disetujui?: number | null;
    tanggal_cair?: string | null;
    metode_pencairan?: MetodePencairan | null;
    bukti_pencairan_url?: string | null;
    metode_potong: MetodePotong;
    jumlah_cicilan: number;
    saldo_kasbon: number;
    catatan?: string | null;
    created_at: string;
    updated_at: string;
};

type KasbonMutasi = {
    mutasi_id: string;
    kasbon_id: string;
    penggajian_id?: string | null;
    tipe_mutasi: string;
    nominal_mutasi: number;
    saldo_sebelum: number;
    saldo_sesudah: number;
    tanggal_mutasi: string;
    catatan?: string | null;
    created_at: string;
};

type FormState = {
    kasbon_id: string;
    pegawai_id: string;
    kontrak_id: string;
    tanggal_pengajuan: string;
    nominal_pengajuan: string;
    alasan: string;
    status_kasbon: StatusKasbon;
    disetujui_oleh: string;
    tanggal_persetujuan: string;
    nominal_disetujui: string;
    tanggal_cair: string;
    metode_pencairan: MetodePencairan | "";
    bukti_pencairan_url: string;
    metode_potong: MetodePotong;
    catatan: string;
};

type MasterPegawaiLite = {
    pegawai_id: string;
    nik?: string;
    nama_lengkap: string;
    status_aktif?: string;
};

/* ===========================
   Constants
   =========================== */

const STATUS_KASBON: StatusKasbon[] = ["diajukan", "disetujui", "ditolak", "dicairkan", "lunas"];
const METODE_PENCAIRAN: MetodePencairan[] = ["tunai", "transfer"];

/* ===========================
   Utilities
   =========================== */

function cn(...xs: Array<string | false | undefined | null>) {
    return xs.filter(Boolean).join(" ");
}

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

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function uuidv4() {
    if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function statusTone(s: StatusKasbon) {
    switch (s) {
        case "diajukan": return "bg-amber-50 text-amber-700 ring-amber-100";
        case "disetujui": return "bg-sky-50 text-sky-700 ring-sky-100";
        case "ditolak": return "bg-rose-50 text-rose-700 ring-rose-100";
        case "dicairkan": return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        case "lunas": return "bg-slate-100 text-slate-700 ring-slate-200";
        default: return "bg-slate-100 text-slate-700 ring-slate-200";
    }
}

function mutasiTipeBadge(t: string) {
    switch (t) {
        case "potong_gaji": return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        case "cicilan_manual": return "bg-amber-50 text-amber-700 ring-amber-100";
        case "penyesuaian": return "bg-sky-50 text-sky-700 ring-sky-100";
        default: return "bg-slate-100 text-slate-700 ring-slate-200";
    }
}

function mutasiTipeLabel(t: string) {
    switch (t) {
        case "potong_gaji": return "Potong Gaji";
        case "cicilan_manual": return "Cicilan Manual";
        case "penyesuaian": return "Penyesuaian";
        default: return t;
    }
}

function useDebouncedValue<T>(value: T, delayMs: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => { const t = setTimeout(() => setDebounced(value), delayMs); return () => clearTimeout(t); }, [value, delayMs]);
    return debounced;
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
    const base = inferApiBase();
    const url = new URL(`${base}/api/masterpegawai`);
    if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
    url.searchParams.set("limit", String(params.limit ?? 20));
    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch pegawai gagal (${res.status})`);
    const json = await res.json();
    return (json?.data ?? json ?? []) as MasterPegawaiLite[];
}

async function apiGetPegawaiById(id: string, signal?: AbortSignal) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/masterpegawai/${id}`, { credentials: "include", signal });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json ?? null) as MasterPegawaiLite | null;
}

async function apiListKasbon(params: { q?: string; limit?: number; offset?: number; signal?: AbortSignal }) {
    const base = inferApiBase();
    const url = new URL(`${base}/api/kasbon`);
    if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
    url.searchParams.set("limit", String(params.limit ?? 200));
    url.searchParams.set("offset", String(params.offset ?? 0));
    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch kasbon gagal (${res.status})`);
    const json = await res.json();
    return (json?.data ?? json ?? []) as Kasbon[];
}

async function apiCreateKasbon(payload: any) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kasbon`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Create kasbon gagal (${res.status})`);
    return (json?.data ?? json) as Kasbon;
}

async function apiUpdateKasbon(kasbon_id: string, payload: any) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kasbon/${kasbon_id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Update kasbon gagal (${res.status})`);
    return (json?.data ?? json) as Kasbon;
}

async function apiDeleteKasbon(kasbon_id: string) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kasbon/${kasbon_id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Delete kasbon gagal (${res.status})`);
    return json;
}

async function apiListMutasi(kasbon_id: string, signal?: AbortSignal) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kasbon/${kasbon_id}/mutasi`, { credentials: "include", signal });
    if (!res.ok) throw new Error(`Fetch mutasi gagal (${res.status})`);
    const json = await res.json();
    return (json?.data ?? json ?? []) as KasbonMutasi[];
}

async function apiCreateMutasi(kasbon_id: string, payload: { tipe_mutasi: string; nominal_mutasi: number; catatan?: string | null }) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kasbon/${kasbon_id}/mutasi`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Create mutasi gagal (${res.status})`);
    return (json?.data ?? json) as KasbonMutasi;
}

/* ===========================
   PegawaiAsyncSelect
   =========================== */

function PegawaiAsyncSelect({ value, onChange, cacheById, onCacheUpsert, disabled, placeholder }: {
    value: string; onChange: (pegawai_id: string) => void; cacheById: Map<string, MasterPegawaiLite>;
    onCacheUpsert: (row: MasterPegawaiLite) => void; disabled?: boolean; placeholder?: string;
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
    const selectedLabel = useMemo(() => (!value ? "" : cacheById.get(value)?.nama_lengkap ?? ""), [value, cacheById]);

    useEffect(() => { let a = true; const ac = new AbortController(); (async () => { if (!value || cacheById.has(value)) return; const r = await apiGetPegawaiById(value, ac.signal); if (!a) return; if (r?.pegawai_id) upsertRef.current(r); })(); return () => { a = false; ac.abort(); }; }, [value, cacheById]);
    useEffect(() => { function h(e: MouseEvent) { if (!rootRef.current?.contains(e.target as any)) setOpen(false); } document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
    useEffect(() => { if (!open) return; abortRef.current?.abort(); const ac = new AbortController(); abortRef.current = ac; const rid = ++reqIdRef.current; setLoading(true); setErr(null); apiListPegawai({ q: debounced, limit: 20, signal: ac.signal }).then((rows) => { if (ac.signal.aborted || rid !== reqIdRef.current) return; rows.forEach((r) => upsertRef.current(r)); setItems(rows); }).catch((e) => { if (e?.name === "AbortError" || ac.signal.aborted) return; setErr(e?.message ?? "Gagal"); }).finally(() => { if (rid === reqIdRef.current) setLoading(false); }); return () => { ac.abort(); }; }, [debounced, open]);

    return (
        <div ref={rootRef} className="relative">
            <div className="relative">
                <input value={open ? text : selectedLabel || text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => { if (!disabled) setOpen(true); }} disabled={disabled} placeholder={placeholder ?? "Cari nama pegawai..."} className={cn("w-full rounded-2xl px-4 py-2.5 pr-10 text-sm ring-1 outline-none focus:ring-4", disabled ? "cursor-not-allowed bg-slate-100 text-slate-500 ring-slate-200" : "bg-slate-50 text-slate-800 ring-slate-200 focus:ring-slate-200/60")} />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {open && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="max-h-72 overflow-y-auto">
                        {err ? <div className="px-4 py-3 text-sm text-rose-700">{err}</div>
                            : items.length === 0 && loading ? <div className="px-4 py-3 text-sm text-slate-600">Memuat...</div>
                                : items.length === 0 ? <div className="px-4 py-3 text-sm text-slate-600">Tidak ada hasil.</div>
                                    : items.map((r) => (
                                        <button key={r.pegawai_id} type="button" onClick={() => { onCacheUpsert(r); onChange(r.pegawai_id); setText(r.nama_lengkap); setOpen(false); }} className={cn("w-full text-left px-4 py-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0", r.pegawai_id === value ? "bg-slate-50" : "bg-white")}>
                                            <div className="text-sm font-semibold text-slate-900">{r.nama_lengkap}</div>
                                            <div className="mt-0.5 text-xs text-slate-500">ID: {r.pegawai_id}{r.nik ? ` \u2022 NIK: ${r.nik}` : ""}</div>
                                        </button>
                                    ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const emptyForm = (): FormState => ({
    kasbon_id: uuidv4(), pegawai_id: "", kontrak_id: "",
    tanggal_pengajuan: todayStr(), nominal_pengajuan: "", alasan: "",
    status_kasbon: "diajukan", disetujui_oleh: "", tanggal_persetujuan: "",
    nominal_disetujui: "", tanggal_cair: "", metode_pencairan: "",
    bukti_pencairan_url: "", metode_potong: "potong_gaji", catatan: "",
});

/* ===========================
   Page
   =========================== */

export default function Page() {
    const [open, setOpen] = useState(true);
    const [rows, setRows] = useState<Kasbon[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [rowsError, setRowsError] = useState<string | null>(null);

    const [pegawaiCache, setPegawaiCache] = useState<Map<string, MasterPegawaiLite>>(new Map());
    const upsertPegawaiCache = useCallback((row: MasterPegawaiLite) => {
        if (!row?.pegawai_id) return;
        setPegawaiCache((prev) => { const n = new Map(prev); n.set(row.pegawai_id, { ...prev.get(row.pegawai_id), ...row }); return n; });
    }, []);

    /* --- Expand: mutasi history --- */
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mutasiMap, setMutasiMap] = useState<Map<string, KasbonMutasi[]>>(new Map());
    const [loadingMutasi, setLoadingMutasi] = useState(false);

    /* --- Bayar/Cicil inline --- */
    const [bayarNominal, setBayarNominal] = useState("");
    const [bayarCatatan, setBayarCatatan] = useState("");
    const [bayarSaving, setBayarSaving] = useState(false);

    const [query, setQuery] = useState("");

    /* --- Tab system: default = Pinjaman Berjalan --- */
    const [activeTab, setActiveTab] = useState<TableTab>("berjalan");

    const PAGE_SIZE = 10;
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    /* Load data */
    useEffect(() => {
        let alive = true; const ac = new AbortController();
        (async () => {
            try { setRowsError(null); setLoadingRows(true); const data = await apiListKasbon({ limit: 200, offset: 0, signal: ac.signal }); if (!alive) return; setRows(Array.isArray(data) ? data : []); }
            catch (e: any) { if (!alive) return; setRowsError(e?.message ?? "Gagal memuat kasbon"); }
            finally { if (alive) setLoadingRows(false); }
        })();
        return () => { alive = false; ac.abort(); };
    }, []);

    const requestedRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (rows.length === 0) return;
        const ac = new AbortController(); let alive = true;
        const missing = Array.from(new Set(rows.map((r) => r.pegawai_id).filter(Boolean))).filter((id) => !pegawaiCache.has(id) && !requestedRef.current.has(id)).slice(0, 50);
        missing.forEach((id) => requestedRef.current.add(id));
        let idx = 0;
        async function worker() { while (alive && idx < missing.length) { const id = missing[idx++]; try { const r = await apiGetPegawaiById(id, ac.signal); if (!alive) return; if (r?.pegawai_id) upsertPegawaiCache(r); } catch { } } }
        (async () => { await Promise.all(Array.from({ length: Math.min(6, missing.length) }, () => worker())); })();
        return () => { alive = false; ac.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]);

    /* WS kasbon */
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_KASBON_URL || inferWsUrl("/ws/kasbon");
        if (!wsUrl) return;
        let ws: WebSocket | null = null; let alive = true; let retry = 0; let t: any = null;
        function upsertRow(row: Kasbon) { setRows((prev) => { const i = prev.findIndex((x) => x.kasbon_id === row.kasbon_id); if (i === -1) return [row, ...prev]; const n = [...prev]; n[i] = row; return n; }); }
        const sched = () => { if (!alive) return; retry = Math.min(retry + 1, 8); t = setTimeout(conn, Math.min(1200 * retry, 8000)); };
        function conn() { if (!alive) return; if (t) clearTimeout(t); try { ws = new WebSocket(wsUrl); } catch { sched(); return; } ws.onopen = () => { retry = 0; }; ws.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m?.tipe !== "kasbon") return; if (m.event === "created" || m.event === "updated") upsertRow(m.payload); if (m.event === "deleted") { const id = String(m.payload?.kasbon_id ?? ""); if (id) setRows((p) => p.filter((x) => x.kasbon_id !== id)); } } catch { } }; ws.onclose = () => sched(); ws.onerror = () => { try { ws?.close(); } catch { } }; }
        conn(); return () => { alive = false; if (t) clearTimeout(t); try { ws?.close(); } catch { } };
    }, []);

    /* Stats */
    const stats = useMemo(() => {
        const diajukan = rows.filter((r) => r.status_kasbon === "diajukan").length;
        const dicairkan = rows.filter((r) => r.status_kasbon === "dicairkan").length;
        const lunas = rows.filter((r) => r.status_kasbon === "lunas").length;
        const totalPinjaman = rows.filter((r) => r.status_kasbon === "dicairkan").reduce((s, r) => s + (r.saldo_kasbon ?? 0), 0);
        return { diajukan, dicairkan, lunas, totalPinjaman };
    }, [rows]);

    /* Tab counts */
    const berjalanCount = useMemo(() => rows.filter((r) => r.status_kasbon !== "lunas").length, [rows]);
    const lunasCount = useMemo(() => rows.filter((r) => r.status_kasbon === "lunas").length, [rows]);

    /* Filtered + sorted: tab filter -> search -> sort (dicairkan first) */
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const tabFiltered = rows.filter((r) =>
            activeTab === "berjalan" ? r.status_kasbon !== "lunas" : r.status_kasbon === "lunas"
        );
        const searched = tabFiltered.filter((r) => {
            if (!q) return true;
            const p = (pegawaiCache.get(r.pegawai_id)?.nama_lengkap ?? "").toLowerCase();
            return [r.kasbon_id, r.pegawai_id, p, r.status_kasbon, r.alasan || "", r.metode_potong].join(" ").toLowerCase().includes(q);
        });
        const statusOrder: Record<string, number> = { dicairkan: 0, disetujui: 1, diajukan: 2, ditolak: 3, lunas: 4 };
        return searched.sort((a, b) => {
            const sa = statusOrder[a.status_kasbon] ?? 9;
            const sb = statusOrder[b.status_kasbon] ?? 9;
            if (sa !== sb) return sa - sb;
            return a.tanggal_pengajuan < b.tanggal_pengajuan ? 1 : -1;
        });
    }, [rows, query, activeTab, pegawaiCache]);

    useEffect(() => { setPage(1); }, [query, activeTab]);
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const startIndex = (clampedPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
    const paged = filtered.slice(startIndex, endIndex);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    /* ===========================
       Mutasi expand + Bayar/Cicil
       =========================== */

    async function toggleExpand(kasbon_id: string) {
        if (expandedId === kasbon_id) { setExpandedId(null); return; }
        setExpandedId(kasbon_id);
        setBayarNominal(""); setBayarCatatan("");
        setLoadingMutasi(true);
        try {
            const data = await apiListMutasi(kasbon_id);
            setMutasiMap((prev) => new Map(prev).set(kasbon_id, data));
        } catch (e: any) { alert(e?.message ?? "Gagal memuat riwayat"); }
        finally { setLoadingMutasi(false); }
    }

    async function submitBayar(kasbon_id: string, sisaPinjaman: number) {
        const nom = Number(bayarNominal);
        if (Number.isNaN(nom) || nom <= 0) { alert("Nominal harus > 0"); return; }
        if (nom > sisaPinjaman) { alert(`Nominal (${toIDR(nom)}) melebihi sisa pinjaman (${toIDR(sisaPinjaman)})`); return; }
        if (!confirm(`Bayar kasbon sebesar ${toIDR(nom)}?`)) return;

        setBayarSaving(true);
        try {
            const mutasi = await apiCreateMutasi(kasbon_id, {
                tipe_mutasi: "cicilan_manual",
                nominal_mutasi: nom,
                catatan: bayarCatatan.trim() || null,
            });
            setMutasiMap((prev) => {
                const next = new Map(prev);
                const list = next.get(kasbon_id) ?? [];
                next.set(kasbon_id, [mutasi, ...list]);
                return next;
            });
            setRows((prev) => prev.map((r) => {
                if (r.kasbon_id !== kasbon_id) return r;
                return {
                    ...r,
                    saldo_kasbon: mutasi.saldo_sesudah,
                    status_kasbon: mutasi.saldo_sesudah <= 0 ? "lunas" as StatusKasbon : "dicairkan" as StatusKasbon,
                };
            }));
            setBayarNominal(""); setBayarCatatan("");
        } catch (e: any) { alert(e?.message ?? "Gagal membayar"); }
        finally { setBayarSaving(false); }
    }

    /* ===========================
       Print slip kasbon
       =========================== */

    async function handlePrint(row: Kasbon) {
        const pegName = pegawaiCache.get(row.pegawai_id)?.nama_lengkap ?? "Pegawai";
        let mutasiList = mutasiMap.get(row.kasbon_id);
        if (!mutasiList) {
            try {
                mutasiList = await apiListMutasi(row.kasbon_id);
                setMutasiMap((prev) => new Map(prev).set(row.kasbon_id, mutasiList!));
            } catch { mutasiList = []; }
        }
        printSlipKasbon(row, mutasiList, pegName);
    }

    /* ===========================
       Kasbon CRUD
       =========================== */

    function openCreate() { setMode("create"); setFormError(null); setForm(emptyForm()); setModalOpen(true); }

    function openEdit(row: Kasbon) {
        setMode("edit"); setFormError(null);
        setForm({
            kasbon_id: row.kasbon_id, pegawai_id: row.pegawai_id, kontrak_id: row.kontrak_id || "",
            tanggal_pengajuan: row.tanggal_pengajuan, nominal_pengajuan: String(row.nominal_pengajuan),
            alasan: row.alasan || "", status_kasbon: row.status_kasbon, disetujui_oleh: row.disetujui_oleh || "",
            tanggal_persetujuan: row.tanggal_persetujuan || "",
            nominal_disetujui: row.nominal_disetujui != null ? String(row.nominal_disetujui) : "",
            tanggal_cair: row.tanggal_cair || "", metode_pencairan: row.metode_pencairan || "",
            bukti_pencairan_url: row.bukti_pencairan_url || "", metode_potong: row.metode_potong,
            catatan: row.catatan || "",
        });
        setModalOpen(true);
    }

    function closeModal() { setModalOpen(false); setFormError(null); }
    function updateForm<K extends keyof FormState>(key: K, val: FormState[K]) { setForm((p) => ({ ...p, [key]: val })); }

    function validateForm(f: FormState) {
        if (!f.pegawai_id.trim()) return "Pegawai wajib dipilih.";
        if (!f.tanggal_pengajuan) return "Tanggal pengajuan wajib.";
        const nom = Number(f.nominal_pengajuan);
        if (!nom || nom <= 0) return "Nominal pengajuan wajib > 0.";
        if ((f.status_kasbon === "dicairkan" || f.status_kasbon === "lunas") && !f.tanggal_cair) return "Tanggal cair wajib untuk status dicairkan/lunas.";
        if ((f.status_kasbon === "dicairkan" || f.status_kasbon === "lunas") && !f.metode_pencairan) return "Metode pencairan wajib.";
        return null;
    }

    async function saveForm() {
        const err = validateForm(form); if (err) { setFormError(err); return; }
        setSaving(true); setFormError(null);
        try {
            const payload: any = {
                kasbon_id: form.kasbon_id, pegawai_id: form.pegawai_id,
                kontrak_id: form.kontrak_id.trim() || null, tanggal_pengajuan: form.tanggal_pengajuan,
                nominal_pengajuan: Number(form.nominal_pengajuan), alasan: form.alasan.trim() || null,
                status_kasbon: form.status_kasbon, disetujui_oleh: form.disetujui_oleh.trim() || null,
                tanggal_persetujuan: form.tanggal_persetujuan || null,
                nominal_disetujui: form.nominal_disetujui ? Number(form.nominal_disetujui) : null,
                tanggal_cair: form.tanggal_cair || null, metode_pencairan: form.metode_pencairan || null,
                bukti_pencairan_url: form.bukti_pencairan_url.trim() || null,
                metode_potong: form.metode_potong, jumlah_cicilan: 0,
                catatan: form.catatan.trim() || null,
            };
            if (form.status_kasbon === "dicairkan" && mode === "create") {
                payload.saldo_kasbon = payload.nominal_disetujui ?? payload.nominal_pengajuan;
            }
            if (mode === "create") {
                const created = await apiCreateKasbon(payload);
                setRows((prev) => { if (prev.some((x) => x.kasbon_id === created.kasbon_id)) return prev; return [created, ...prev]; });
            } else {
                const updated = await apiUpdateKasbon(form.kasbon_id, payload);
                setRows((prev) => prev.map((x) => (x.kasbon_id === updated.kasbon_id ? updated : x)));
            }
            closeModal();
        } catch (e: any) { setFormError(e?.message ?? "Gagal menyimpan"); }
        finally { setSaving(false); }
    }

    async function deleteRow(id: string) { if (!confirm(`Hapus kasbon ${id}?`)) return; try { await apiDeleteKasbon(id); setRows((p) => p.filter((r) => r.kasbon_id !== id)); } catch (e: any) { alert(e?.message ?? "Gagal"); } }
    async function approveKasbon(row: Kasbon) { if (!confirm(`Setujui kasbon dari ${pegawaiCache.get(row.pegawai_id)?.nama_lengkap ?? row.pegawai_id}?`)) return; try { const u = await apiUpdateKasbon(row.kasbon_id, { status_kasbon: "disetujui", tanggal_persetujuan: todayStr(), nominal_disetujui: row.nominal_pengajuan, disetujui_oleh: "Admin" }); setRows((p) => p.map((x) => (x.kasbon_id === u.kasbon_id ? u : x))); } catch (e: any) { alert(e?.message ?? "Gagal"); } }
    async function rejectKasbon(row: Kasbon) { if (!confirm("Tolak kasbon ini?")) return; try { const u = await apiUpdateKasbon(row.kasbon_id, { status_kasbon: "ditolak" }); setRows((p) => p.map((x) => (x.kasbon_id === u.kasbon_id ? u : x))); } catch (e: any) { alert(e?.message ?? "Gagal"); } }
    async function disburseKasbon(row: Kasbon) { if (!confirm("Cairkan kasbon ini?")) return; try { const u = await apiUpdateKasbon(row.kasbon_id, { status_kasbon: "dicairkan", tanggal_cair: todayStr(), metode_pencairan: "transfer", saldo_kasbon: row.nominal_disetujui ?? row.nominal_pengajuan }); setRows((p) => p.map((x) => (x.kasbon_id === u.kasbon_id ? u : x))); } catch (e: any) { alert(e?.message ?? "Gagal"); } }

    function exportCSV() {
        const headers = ["kasbon_id", "pegawai_id", "tanggal_pengajuan", "nominal_pengajuan", "status_kasbon", "nominal_disetujui", "saldo_kasbon", "metode_potong", "tanggal_cair", "metode_pencairan", "alasan", "catatan"];
        const csv = [headers.join(","), ...filtered.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replaceAll('"', '""')}"`).join(","))].join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `kasbon_${todayStr()}.csv`; a.click(); URL.revokeObjectURL(url);
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
                                <div className="flex items-start gap-4">
                                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm"><HandCoins className="h-6 w-6" /></div>
                                    <div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><IdCard className="w-3.5 h-3.5" />Dashboard</span><span className="text-slate-300">/</span><span>Pegawai</span><span className="text-slate-300">/</span><span className="text-slate-700 font-medium">Kasbon</span></div>
                                        <h1 className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">Manajemen Kasbon</h1>
                                        <p className="mt-1 text-sm text-slate-600">Pengajuan, pencairan, cicilan manual tanpa tenggat, dan riwayat mutasi pembayaran.</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"><Plus className="h-4 w-4" />Ajukan Kasbon</button>
                                    <button onClick={exportCSV} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Download className="h-4 w-4" />Export</button>
                                </div>
                            </div>
                        </div>

                        {/* Info banner — "saldo" diganti "pinjaman" */}
                        <div className="mb-4 rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" />
                                <div className="text-xs text-sky-900">
                                    Setiap kasbon aktif (pinjaman &gt; 0) bisa dicicil kapan saja, berapa saja, <span className="font-bold">tanpa tenggat dan tanpa batasan berapa kali</span>.
                                    Klik baris kasbon untuk melihat riwayat mutasi dan melakukan pembayaran.
                                    Kasbon metode <span className="font-semibold text-emerald-800">Potong Gaji</span> juga otomatis muncul di slip gaji \u2014 tapi tetap bisa dicicil manual di sini.
                                </div>
                            </div>
                        </div>

                        {/* Stats — "saldo" diganti "pinjaman" */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Menunggu Persetujuan" value={stats.diajukan} icon={<Clock className="w-5 h-5" />} hint="Status: diajukan" />
                            <StatCard title="Pinjaman Aktif" value={stats.dicairkan} icon={<CircleDollarSign className="w-5 h-5" />} hint="Sudah dicairkan" />
                            <StatCard title="Lunas" value={stats.lunas} icon={<CheckCircle2 className="w-5 h-5" />} hint="Sudah terbayar penuh" />
                            <StatCard title="Total Pinjaman Berjalan" value={null} valueStr={toIDR(stats.totalPinjaman)} icon={<Wallet className="w-5 h-5" />} hint="Belum terbayar" />
                        </div>

                        {/* Table */}
                        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            {/* ===== TABS + SEARCH ===== */}
                            <div className="border-b border-slate-100 p-4 md:p-5 space-y-3">
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setActiveTab("berjalan")} className={cn("rounded-2xl px-4 py-2 text-sm font-semibold transition", activeTab === "berjalan" ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700")}>
                                        <HandCoins className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />Pinjaman Berjalan
                                        <span className={cn("ml-1.5 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold", activeTab === "berjalan" ? "bg-amber-200/80 text-amber-900" : "bg-slate-100 text-slate-500")}>{berjalanCount}</span>
                                    </button>
                                    <button onClick={() => setActiveTab("lunas")} className={cn("rounded-2xl px-4 py-2 text-sm font-semibold transition", activeTab === "lunas" ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700")}>
                                        <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />Lunas
                                        <span className={cn("ml-1.5 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold", activeTab === "lunas" ? "bg-emerald-200/80 text-emerald-900" : "bg-slate-100 text-slate-500")}>{lunasCount}</span>
                                    </button>
                                </div>
                                <div className="relative w-full lg:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kasbon..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:ring-4 focus:ring-slate-200/60" /></div>
                                {loadingRows && <div className="text-xs text-slate-500">Memuat...</div>}
                                {rowsError && <div className="text-xs text-rose-700">{rowsError}</div>}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-max min-w-[1100px] text-sm table-auto">
                                    <thead><tr className="bg-slate-50 text-left text-xs text-slate-500">
                                        <th className="px-5 py-3 font-semibold w-8"></th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Pegawai</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Tgl Pengajuan</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Nominal</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Sisa Pinjaman</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Metode</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Status</th>
                                        <th className="px-5 py-3 font-semibold text-right whitespace-nowrap">Aksi</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paged.length === 0 ? <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">{activeTab === "berjalan" ? "Tidak ada pinjaman berjalan." : "Tidak ada kasbon lunas."}</td></tr>
                                            : paged.map((r) => {
                                                const pegName = pegawaiCache.get(r.pegawai_id)?.nama_lengkap || "(Memuat...)";
                                                const isExpanded = expandedId === r.kasbon_id;
                                                const mutasiList = mutasiMap.get(r.kasbon_id) ?? [];
                                                const canExpand = r.status_kasbon === "dicairkan" || r.status_kasbon === "lunas";
                                                const canPay = r.status_kasbon === "dicairkan" && r.saldo_kasbon > 0;
                                                const canPrint = r.status_kasbon === "dicairkan" || r.status_kasbon === "lunas";
                                                const totalPinjaman = r.nominal_disetujui ?? r.nominal_pengajuan;

                                                return (
                                                    <React.Fragment key={r.kasbon_id}>
                                                        <tr className={cn("hover:bg-slate-50/60 transition", canExpand && "cursor-pointer")} onClick={() => canExpand && toggleExpand(r.kasbon_id)}>
                                                            <td className="px-5 py-4 align-top">
                                                                {canExpand && (isExpanded ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-400" />)}
                                                            </td>
                                                            <td className="px-5 py-4 align-top whitespace-nowrap">
                                                                <div className="inline-flex items-center gap-2"><div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200"><User className="h-4 w-4 text-slate-700" /></div><div><div className="font-semibold text-slate-900">{pegName}</div><div className="text-xs text-slate-500">ID: {r.kasbon_id.slice(0, 8)}...{r.alasan && <span className="ml-1 text-slate-400">\u2014 {r.alasan.length > 30 ? r.alasan.slice(0, 30) + "..." : r.alasan}</span>}</div></div></div>
                                                            </td>
                                                            <td className="px-5 py-4 align-top whitespace-nowrap text-slate-800">{formatDate(r.tanggal_pengajuan)}</td>
                                                            <td className="px-5 py-4 align-top whitespace-nowrap">
                                                                <div className="font-semibold text-slate-900">{toIDR(totalPinjaman)}</div>
                                                                {r.nominal_disetujui != null && r.nominal_disetujui !== r.nominal_pengajuan && <div className="text-xs text-slate-500">Diajukan: {toIDR(r.nominal_pengajuan)}</div>}
                                                            </td>
                                                            <td className="px-5 py-4 align-top whitespace-nowrap">
                                                                <span className={cn("text-lg font-extrabold", r.saldo_kasbon > 0 ? "text-amber-700" : "text-emerald-700")}>
                                                                    {toIDR(r.saldo_kasbon)}
                                                                </span>
                                                                {r.status_kasbon === "dicairkan" && r.saldo_kasbon > 0 && (
                                                                    <div className="text-[10px] text-slate-500 mt-0.5">Terbayar: {toIDR(totalPinjaman - r.saldo_kasbon)}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4 align-top whitespace-nowrap">
                                                                {r.metode_potong === "potong_gaji"
                                                                    ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">Potong Gaji</span>
                                                                    : <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">Cicilan</span>}
                                                            </td>
                                                            <td className="px-5 py-4 align-top whitespace-nowrap"><span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone(r.status_kasbon))}>{r.status_kasbon}</span></td>
                                                            <td className="px-5 py-4 align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    {canPrint && <IconButton title="Cetak Slip Kasbon" onClick={() => handlePrint(r)}><Printer className="h-4 w-4" /></IconButton>}
                                                                    {canPay && (
                                                                        <button onClick={() => { if (!isExpanded) toggleExpand(r.kasbon_id); }} className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 transition" title="Bayar/Cicil manual">
                                                                            <HandCoins className="h-3.5 w-3.5 inline mr-1" />Cicil
                                                                        </button>
                                                                    )}
                                                                    {r.status_kasbon === "diajukan" && <>
                                                                        <IconButton title="Setujui" onClick={() => approveKasbon(r)}><BadgeCheck className="h-4 w-4" /></IconButton>
                                                                        <IconButton title="Tolak" danger onClick={() => rejectKasbon(r)}><CircleSlash className="h-4 w-4" /></IconButton>
                                                                    </>}
                                                                    {r.status_kasbon === "disetujui" && <IconButton title="Cairkan" onClick={() => disburseKasbon(r)}><Banknote className="h-4 w-4" /></IconButton>}
                                                                    <IconButton title="Edit" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></IconButton>
                                                                    <IconButton title="Hapus" danger onClick={() => deleteRow(r.kasbon_id)}><Trash2 className="h-4 w-4" /></IconButton>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* EXPANDED ROW: Bayar + Riwayat Mutasi */}
                                                        {isExpanded && (
                                                            <tr><td colSpan={8} className="bg-slate-50/80 px-5 py-4">
                                                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">

                                                                    {/* Bayar/Cicil Form — "saldo" diganti "pinjaman" */}
                                                                    {canPay && (
                                                                        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <HandCoins className="h-4 w-4 text-amber-700" />
                                                                                <span className="text-sm font-bold text-amber-900">Bayar / Cicil Manual</span>
                                                                                <span className="ml-auto text-xs text-amber-700">Sisa pinjaman: <span className="font-bold text-base">{toIDR(r.saldo_kasbon)}</span></span>
                                                                            </div>
                                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                                                                <div className="flex-1">
                                                                                    <div className="text-[11px] font-semibold text-amber-800 mb-1">Nominal Pembayaran (Rp) \u2014 bebas berapa saja</div>
                                                                                    <input type="number" inputMode="numeric" min={1} max={r.saldo_kasbon} value={bayarNominal} onChange={(e) => setBayarNominal(e.target.value)} placeholder={`1 s/d ${toIDR(r.saldo_kasbon)}`} className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-slate-800 ring-1 ring-amber-200 outline-none focus:ring-4 focus:ring-amber-100" />
                                                                                </div>
                                                                                <div className="flex-1 max-w-xs">
                                                                                    <div className="text-[11px] font-semibold text-amber-800 mb-1">Catatan (opsional)</div>
                                                                                    <input value={bayarCatatan} onChange={(e) => setBayarCatatan(e.target.value)} placeholder="Cicilan ke-..., dll." className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-slate-800 ring-1 ring-amber-200 outline-none focus:ring-4 focus:ring-amber-100" />
                                                                                </div>
                                                                                <div className="flex gap-2 shrink-0">
                                                                                    <button onClick={() => submitBayar(r.kasbon_id, r.saldo_kasbon)} disabled={bayarSaving || !bayarNominal} className="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50 transition">
                                                                                        {bayarSaving ? "Memproses..." : `Bayar ${bayarNominal ? toIDR(Number(bayarNominal) || 0) : ""}`}
                                                                                    </button>
                                                                                    <button onClick={() => { setBayarNominal(String(r.saldo_kasbon)); }} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition" title="Isi nominal = sisa pinjaman (lunasi)">
                                                                                        Lunasi
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 text-[11px] text-amber-700/70">Tanpa tenggat \u2014 bayar kapan saja, berapa saja, sampai lunas. Setiap pembayaran tercatat di riwayat mutasi.</div>
                                                                        </div>
                                                                    )}

                                                                    {r.status_kasbon === "lunas" && (
                                                                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                                                                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Pinjaman ini sudah LUNAS</div>
                                                                        </div>
                                                                    )}

                                                                    {/* Riwayat Mutasi — header "Saldo" diganti "Pinjaman" */}
                                                                    <div>
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <History className="h-4 w-4 text-slate-500" />
                                                                            <span className="text-sm font-bold text-slate-900">Riwayat Mutasi Pembayaran</span>
                                                                            <span className="text-xs text-slate-500">({mutasiList.length} transaksi)</span>
                                                                            <button onClick={() => handlePrint(r)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"><Printer className="h-3.5 w-3.5" />Cetak Slip</button>
                                                                        </div>
                                                                        {loadingMutasi && mutasiList.length === 0 ? <div className="text-sm text-slate-500">Memuat riwayat...</div>
                                                                            : mutasiList.length === 0 ? <div className="text-sm text-slate-500 italic">Belum ada riwayat pembayaran.</div>
                                                                                : (
                                                                                    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
                                                                                        <table className="w-full text-sm">
                                                                                            <thead><tr className="text-left text-xs text-slate-500 bg-slate-50">
                                                                                                <th className="px-3 py-2.5 font-semibold">#</th>
                                                                                                <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                                                                                                <th className="px-3 py-2.5 font-semibold">Sumber</th>
                                                                                                <th className="px-3 py-2.5 font-semibold">Dibayar</th>
                                                                                                <th className="px-3 py-2.5 font-semibold">Pinjaman Sebelum</th>
                                                                                                <th className="px-3 py-2.5 font-semibold">Pinjaman Sesudah</th>
                                                                                                <th className="px-3 py-2.5 font-semibold">Catatan</th>
                                                                                            </tr></thead>
                                                                                            <tbody className="divide-y divide-slate-100">
                                                                                                {mutasiList.map((m, idx) => (
                                                                                                    <tr key={m.mutasi_id} className="hover:bg-slate-50/60 transition">
                                                                                                        <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">{mutasiList.length - idx}</td>
                                                                                                        <td className="px-3 py-2.5 text-slate-800">{formatDate(m.tanggal_mutasi)}</td>
                                                                                                        <td className="px-3 py-2.5">
                                                                                                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1", mutasiTipeBadge(m.tipe_mutasi))}>{mutasiTipeLabel(m.tipe_mutasi)}</span>
                                                                                                            {m.penggajian_id && <div className="text-[10px] text-emerald-700 mt-0.5">Slip: {m.penggajian_id.slice(0, 8)}...</div>}
                                                                                                        </td>
                                                                                                        <td className="px-3 py-2.5 font-bold text-rose-700">&minus;{toIDR(m.nominal_mutasi)}</td>
                                                                                                        <td className="px-3 py-2.5 text-slate-600">{toIDR(m.saldo_sebelum)}</td>
                                                                                                        <td className="px-3 py-2.5 font-semibold text-slate-900">{toIDR(m.saldo_sesudah)}{m.saldo_sesudah <= 0 && <span className="ml-1 text-[10px] font-bold text-emerald-700">LUNAS</span>}</td>
                                                                                                        <td className="px-3 py-2.5 text-slate-500 max-w-[200px] truncate">{m.catatan || "-"}</td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                )}
                                                                    </div>
                                                                </div>
                                                            </td></tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                <div className="text-xs text-slate-500">Menampilkan <span className="font-semibold text-slate-700">{totalItems === 0 ? 0 : startIndex + 1}&ndash;{endIndex}</span> dari <span className="font-semibold text-slate-700">{totalItems}</span></div>
                                <div className="inline-flex items-center gap-1">
                                    <PagerButton title="First" onClick={() => setPage(1)} disabled={clampedPage === 1}><ChevronsLeft className="h-4 w-4" /></PagerButton>
                                    <PagerButton title="Prev" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage === 1}><ChevronLeft className="h-4 w-4" /></PagerButton>
                                    <div className="mx-1 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{clampedPage} / {totalPages}</div>
                                    <PagerButton title="Next" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage === totalPages}><ChevronRight className="h-4 w-4" /></PagerButton>
                                    <PagerButton title="Last" onClick={() => setPage(totalPages)} disabled={clampedPage === totalPages}><ChevronsRight className="h-4 w-4" /></PagerButton>
                                </div>
                            </div>
                        </div>

                        {/* MODAL: Ajukan/Edit Kasbon */}
                        {modalOpen && (
                            <div className="fixed inset-0 z-50">
                                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
                                <div className="absolute inset-0 flex items-end justify-center p-3 sm:items-center sm:p-6">
                                    <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl flex flex-col">
                                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
                                            <div className="flex items-start gap-3"><div className="rounded-2xl bg-slate-900 p-2.5 text-white"><HandCoins className="h-5 w-5" /></div><div><div className="text-xs text-slate-500">sbpv3.t_kasbon</div><h2 className="text-base font-bold text-slate-900 sm:text-lg">{mode === "create" ? "Ajukan Kasbon Baru" : "Edit Kasbon"}</h2></div></div>
                                            <button onClick={closeModal} className="rounded-2xl p-2 text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                                        </div>
                                        <div className="p-5 overflow-y-auto flex-1">
                                            {formError && <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-100">{formError}</div>}
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <FieldLabel label="Kasbon ID (readonly)" icon={<IdCard className="h-4 w-4" />}><input value={form.kasbon_id} readOnly className="w-full cursor-not-allowed rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 outline-none" /></FieldLabel>
                                                <FieldLabel label="Pegawai" icon={<User className="h-4 w-4" />}><PegawaiAsyncSelect value={form.pegawai_id} onChange={(id) => updateForm("pegawai_id", id)} cacheById={pegawaiCache} onCacheUpsert={upsertPegawaiCache} /></FieldLabel>
                                                <FieldLabel label="Tanggal Pengajuan" icon={<Calendar className="h-4 w-4" />}><input type="date" value={form.tanggal_pengajuan} onChange={(e) => updateForm("tanggal_pengajuan", e.target.value)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel>
                                                <FieldLabel label="Nominal Pengajuan (Rp)" icon={<Wallet className="h-4 w-4" />}>
                                                    <input type="number" inputMode="numeric" min={0} value={form.nominal_pengajuan} onChange={(e) => updateForm("nominal_pengajuan", e.target.value)} placeholder="500000" className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" />
                                                    <div className="mt-1 text-[11px] text-slate-500">Preview: {form.nominal_pengajuan ? toIDR(Number(form.nominal_pengajuan)) : "-"}</div>
                                                </FieldLabel>
                                                <FieldLabel label="Metode Potong" icon={<CircleDollarSign className="h-4 w-4" />}>
                                                    <select value={form.metode_potong} onChange={(e) => updateForm("metode_potong", e.target.value as MetodePotong)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60">
                                                        <option value="potong_gaji">Potong Gaji (otomatis muncul di slip gaji)</option>
                                                        <option value="cicilan">Cicilan (bayar manual di halaman ini)</option>
                                                    </select>
                                                    <div className="mt-1 text-[11px] text-slate-500">Apapun metode-nya, cicilan manual selalu bisa dilakukan di halaman kasbon.</div>
                                                </FieldLabel>
                                                <FieldLabel label="Status" icon={<CircleAlert className="h-4 w-4" />}><select value={form.status_kasbon} onChange={(e) => updateForm("status_kasbon", e.target.value as StatusKasbon)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60">{STATUS_KASBON.map((s) => <option key={s} value={s}>{s}</option>)}</select></FieldLabel>
                                                <FieldLabel label="Disetujui Oleh (opsional)" icon={<BadgeCheck className="h-4 w-4" />}><input value={form.disetujui_oleh} onChange={(e) => updateForm("disetujui_oleh", e.target.value)} placeholder="Nama approver" className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel>
                                                <FieldLabel label="Nominal Disetujui (opsional)" icon={<Wallet className="h-4 w-4" />}><input type="number" inputMode="numeric" min={0} value={form.nominal_disetujui} onChange={(e) => updateForm("nominal_disetujui", e.target.value)} placeholder="Bisa beda dari pengajuan" className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel>
                                                <FieldLabel label="Tanggal Cair (opsional)" icon={<Calendar className="h-4 w-4" />}><input type="date" value={form.tanggal_cair} onChange={(e) => updateForm("tanggal_cair", e.target.value)} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel>
                                                <FieldLabel label="Metode Pencairan (opsional)" icon={<Banknote className="h-4 w-4" />}><select value={form.metode_pencairan} onChange={(e) => updateForm("metode_pencairan", e.target.value as MetodePencairan | "")} className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"><option value="">-</option>{METODE_PENCAIRAN.map((m) => <option key={m} value={m}>{m}</option>)}</select></FieldLabel>
                                                <div className="md:col-span-2"><FieldLabel label="Alasan (opsional)" icon={<FileText className="h-4 w-4" />}><textarea value={form.alasan} onChange={(e) => updateForm("alasan", e.target.value)} rows={2} placeholder="Keperluan darurat, dll." className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel></div>
                                                <div className="md:col-span-2"><FieldLabel label="Catatan (opsional)" icon={<FileText className="h-4 w-4" />}><textarea value={form.catatan} onChange={(e) => updateForm("catatan", e.target.value)} rows={2} placeholder="Catatan internal..." className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60" /></FieldLabel></div>
                                            </div>
                                            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                                                <button onClick={closeModal} disabled={saving} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Batal</button>
                                                <button onClick={saveForm} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">{mode === "create" ? <><Plus className="h-4 w-4" />{saving ? "Menyimpan..." : "Simpan"}</> : <><Pencil className="h-4 w-4" />{saving ? "Mengupdate..." : "Update"}</>}</button>
                                            </div>
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

function StatCard({ title, value, valueStr, hint, icon }: { title: string; value?: number | null; valueStr?: string; hint: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs text-slate-500">{title}</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">{valueStr ?? value ?? 0}</div>
                    <div className="mt-1 text-xs text-slate-500">{hint}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-2.5 text-slate-700 ring-1 ring-slate-200">{icon}</div>
            </div>
        </div>
    );
}

function IconButton({ children, title, danger, onClick }: { children: React.ReactNode; title: string; danger?: boolean; onClick?: () => void }) {
    return <button onClick={onClick} title={title} className={cn("rounded-2xl p-2 ring-1 shadow-sm transition", danger ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>{children}</button>;
}

function PagerButton({ children, title, disabled, onClick }: { children: React.ReactNode; title: string; disabled?: boolean; onClick: () => void }) {
    return <button type="button" title={title} onClick={onClick} disabled={disabled} className={cn("inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold ring-1 transition", disabled ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-slate-200" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}>{children}</button>;
}

function FieldLabel({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><span className="text-slate-500">{icon}</span>{label}</div>
            {children}
        </div>
    );
}