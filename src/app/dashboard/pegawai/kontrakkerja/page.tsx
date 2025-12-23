"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    BadgeCheck,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    CircleSlash,
    Download,
    FileText,
    Filter,
    IdCard,
    Link as LinkIcon,
    MapPin,
    Pencil,
    Plus,
    Search,
    Trash2,
    User,
    Wallet,
    X,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

type TipeKontrak = "Harian" | "Lepas" | "Borongan" | "PKWT" | "PKWTT";
type StatusKontrak = "aktif" | "selesai" | "putus";
type KategoriPekerja = "Skill" | "Non-skill";

type KontrakKerja = {
    kontrak_id: string; // uuid
    pegawai_id: string; // uuid
    vendor_id?: string;

    tipe_kontrak: TipeKontrak;
    jabatan: string;
    kategori_pekerja: KategoriPekerja;

    mulai_kontrak: string; // YYYY-MM-DD
    akhir_kontrak?: string; // YYYY-MM-DD | ""

    status_kontrak: StatusKontrak;

    upah_harian_default?: number;
    upah_mingguan_default?: number;
    upah_bulanan_default?: number;

    lokasi_penempatan_default?: string;
    dokumen_kontrak_url?: string;

    created_at: string;
    updated_at: string;
};

type FormState = Omit<KontrakKerja, "created_at" | "updated_at"> & {
    enable_upah_harian: boolean;
    enable_upah_mingguan: boolean;
    enable_upah_bulanan: boolean;
};

type VendorOption = { id: string; nama: string };

type MasterPegawaiLite = {
    pegawai_id: string;
    nik?: string;
    nama_lengkap: string;
    status_aktif?: string;
};

const TIPE_KONTRAK: TipeKontrak[] = ["Harian", "Lepas", "Borongan", "PKWT", "PKWTT"];
const STATUS_KONTRAK: StatusKontrak[] = ["aktif", "selesai", "putus"];
const KATEGORI: KategoriPekerja[] = ["Skill", "Non-skill"];

function cn(...xs: Array<string | false | undefined | null>) {
    return xs.filter(Boolean).join(" ");
}

/** IMPORTANT: pastikan selalu UUID v4 (backend Postgres biasanya strict uuid) */
function uuidv4() {
    // modern browsers
    // @ts-ignore
    if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();

    // crypto.getRandomValues fallback
    // @ts-ignore
    const cryptoObj: Crypto | undefined = globalThis?.crypto;
    if (cryptoObj?.getRandomValues) {
        const bytes = new Uint8Array(16);
        cryptoObj.getRandomValues(bytes);

        // RFC 4122 v4
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // last resort (uuid-shaped, but less ideal)
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${s4().slice(
        1
    )}-${s4()}${s4()}${s4()}`;
}

function toIDR(n?: number) {
    if (n == null || Number.isNaN(n)) return "-";
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n);
}

function formatDate(d?: string) {
    if (!d) return "-";
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return d;
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(dt);
}

function daysUntil(dateStr?: string) {
    if (!dateStr) return null;
    const target = new Date(`${dateStr}T00:00:00`).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    if (Number.isNaN(target)) return null;
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function chipTone(status: StatusKontrak) {
    switch (status) {
        case "aktif":
            return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        case "selesai":
            return "bg-slate-100 text-slate-700 ring-slate-200";
        case "putus":
            return "bg-rose-50 text-rose-700 ring-rose-100";
        default:
            return "bg-slate-100 text-slate-700 ring-slate-200";
    }
}

function dueTone(days: number) {
    if (days <= 3) return "bg-rose-50 text-rose-700 ring-rose-100";
    if (days <= 7) return "bg-amber-50 text-amber-700 ring-amber-100";
    return "bg-sky-50 text-sky-700 ring-sky-100";
}

const emptyForm = (): FormState => ({
    kontrak_id: uuidv4(),
    pegawai_id: "",
    vendor_id: "",
    tipe_kontrak: "PKWT",
    jabatan: "Tukang",
    kategori_pekerja: "Skill",
    mulai_kontrak: "",
    akhir_kontrak: "",
    status_kontrak: "aktif",

    enable_upah_harian: false,
    enable_upah_mingguan: false,
    enable_upah_bulanan: true,

    upah_harian_default: undefined,
    upah_mingguan_default: undefined,
    upah_bulanan_default: undefined,

    lokasi_penempatan_default: "",
    dokumen_kontrak_url: "",
});

type WageChip = { label: "Harian" | "Mingguan" | "Bulanan"; value?: number };

function getWageChips(r: KontrakKerja): WageChip[] {
    return [
        { label: "Harian", value: r.upah_harian_default },
        { label: "Mingguan", value: r.upah_mingguan_default },
        { label: "Bulanan", value: r.upah_bulanan_default },
    ];
}

function wagesTooltip(r: KontrakKerja) {
    const list = getWageChips(r)
        .map((x) => `${x.label}: ${x.value != null ? toIDR(x.value) : "-"}`)
        .join(" • ");
    return `Upah default → ${list}`;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

/* ===========================
   API/WS base helpers
   =========================== */

function inferApiBase() {
    if (typeof window === "undefined") return "";
    const env = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (env) return env.replace(/\/$/, "");

    // default: backend actix di :8080
    const proto = window.location.protocol; // http: / https:
    const host = window.location.hostname;
    return `${proto}//${host}:8080`;
}

function inferWsUrl(path: string) {
    if (typeof window === "undefined") return "";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    return `${proto}://${host}:8080${path}`;
}

/* ===========================
   REST: Pegawai
   =========================== */

async function apiListPegawai(params: { q?: string; limit?: number; signal?: AbortSignal }) {
    const q = params.q?.trim() ?? "";
    const limit = params.limit ?? 20;

    const base = inferApiBase();
    const url = new URL(`${base}/api/masterpegawai`);
    if (q) url.searchParams.set("q", q);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch masterpegawai gagal (${res.status})`);
    const json = await res.json();
    const data: MasterPegawaiLite[] = json?.data ?? json ?? [];
    return data;
}

async function apiGetPegawaiById(pegawai_id: string, signal?: AbortSignal) {
    const base = inferApiBase();
    const url = `${base}/api/masterpegawai/${pegawai_id}`;
    const res = await fetch(url, { credentials: "include", signal });
    if (!res.ok) return null;
    const json = await res.json();
    const row: MasterPegawaiLite = json?.data ?? json ?? null;
    return row;
}

/* ===========================
   REST: Kontrak Kerja
   =========================== */

async function apiListKontrakKerja(params: { q?: string; limit?: number; offset?: number; signal?: AbortSignal }) {
    const base = inferApiBase();
    const url = new URL(`${base}/api/kontrakkerja`);
    if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
    url.searchParams.set("limit", String(params.limit ?? 200));
    url.searchParams.set("offset", String(params.offset ?? 0));

    const res = await fetch(url.toString(), { signal: params.signal, credentials: "include" });
    if (!res.ok) throw new Error(`Fetch kontrak kerja gagal (${res.status})`);
    const json = await res.json();
    const data: KontrakKerja[] = json?.data ?? json ?? [];
    return data;
}

async function apiCreateKontrakKerja(payload: any) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kontrakkerja`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Create kontrak gagal (${res.status})`);
    return (json?.data ?? json) as KontrakKerja;
}

async function apiUpdateKontrakKerja(kontrak_id: string, payload: any) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kontrakkerja/${kontrak_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Update kontrak gagal (${res.status})`);
    return (json?.data ?? json) as KontrakKerja;
}

async function apiDeleteKontrakKerja(kontrak_id: string) {
    const base = inferApiBase();
    const res = await fetch(`${base}/api/kontrakkerja/${kontrak_id}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Delete kontrak gagal (${res.status})`);
    return json?.data ?? json;
}

/** Async searchable select: cari nama pegawai (debounce), simpan pegawai_id */
function PegawaiAsyncSelect({
                                value,
                                onChange,
                                cacheById,
                                onCacheUpsert,
                                disabled,
                                placeholder,
                            }: {
    value: string;
    onChange: (pegawai_id: string) => void;
    cacheById: Map<string, MasterPegawaiLite>;
    onCacheUpsert: (row: MasterPegawaiLite) => void;
    disabled?: boolean;
    placeholder?: string;
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
    useEffect(() => {
        upsertRef.current = onCacheUpsert;
    }, [onCacheUpsert]);

    const selectedLabel = useMemo(() => {
        if (!value) return "";
        return cacheById.get(value)?.nama_lengkap ?? "";
    }, [value, cacheById]);

    // kalau value ada tapi cache belum punya (edit row lama), fetch by id
    useEffect(() => {
        let active = true;
        const ac = new AbortController();
        (async () => {
            if (!value) return;
            if (cacheById.has(value)) return;
            const row = await apiGetPegawaiById(value, ac.signal);
            if (!active) return;
            if (row?.pegawai_id) upsertRef.current(row);
        })();
        return () => {
            active = false;
            ac.abort();
        };
    }, [value, cacheById]);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as any)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    useEffect(() => {
        if (!open) return;

        abortRef.current?.abort("superseded");
        const ac = new AbortController();
        abortRef.current = ac;

        const reqId = ++reqIdRef.current;

        setLoading(true);
        setErr(null);

        apiListPegawai({ q: debounced, limit: 20, signal: ac.signal })
            .then((rows) => {
                if (ac.signal.aborted) return;
                if (reqId !== reqIdRef.current) return;

                rows.forEach((r) => upsertRef.current(r));
                setItems(rows);
            })
            .catch((e) => {
                if (e?.name === "AbortError") return;
                if (ac.signal.aborted) return;
                setErr(e?.message ?? "Gagal memuat pegawai");
            })
            .finally(() => {
                if (reqId === reqIdRef.current) setLoading(false);
            });

        return () => {
            ac.abort("cleanup");
        };
    }, [debounced, open]);

    function handleFocus() {
        if (disabled) return;
        setOpen(true);
    }

    function selectItem(row: MasterPegawaiLite) {
        upsertRef.current(row);
        onChange(row.pegawai_id);
        setText(row.nama_lengkap);
        setOpen(false);
    }

    return (
        <div ref={rootRef} className="relative">
            <div className="relative">
                <input
                    value={open ? text : selectedLabel || text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={handleFocus}
                    disabled={disabled}
                    placeholder={placeholder ?? "Cari nama pegawai..."}
                    className={cn(
                        "w-full rounded-2xl px-4 py-2.5 pr-10 text-sm ring-1 outline-none focus:ring-4",
                        disabled
                            ? "cursor-not-allowed bg-slate-100 text-slate-500 ring-slate-200"
                            : "bg-slate-50 text-slate-800 ring-slate-200 focus:ring-slate-200/60"
                    )}
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {open ? (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="max-h-72 overflow-y-auto">
                        {err ? (
                            <div className="px-4 py-3 text-sm text-rose-700">{err}</div>
                        ) : items.length === 0 && loading ? (
                            <div className="px-4 py-3 text-sm text-slate-600">Memuat pegawai...</div>
                        ) : items.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-600">Tidak ada hasil.</div>
                        ) : (
                            <>
                                {loading ? (
                                    <div className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-100">Memuat ulang…</div>
                                ) : null}

                                {items.map((r) => {
                                    const active = r.pegawai_id === value;
                                    return (
                                        <button
                                            key={r.pegawai_id}
                                            type="button"
                                            onClick={() => selectItem(r)}
                                            className={cn(
                                                "w-full text-left px-4 py-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0",
                                                active ? "bg-slate-50" : "bg-white"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">{r.nama_lengkap}</div>
                                                    <div className="mt-0.5 text-xs text-slate-500">
                                                        <span className="font-medium text-slate-600">ID:</span> {r.pegawai_id}
                                                        {r.nik ? (
                                                            <>
                                                                {" "}
                                                                • <span className="font-medium text-slate-600">NIK:</span> {r.nik}
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                {active ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                            Terpilih
                          </span>
                                                ) : null}
                                            </div>
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
                        Ketik untuk mencari (debounce 250ms). Disimpan tetap <span className="font-semibold">pegawai_id</span>.
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default function Page() {
    const [open, setOpen] = useState(true);

    // Vendor (opsional)
    const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);

    // Kontrak dari DB
    const [rows, setRows] = useState<KontrakKerja[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [rowsError, setRowsError] = useState<string | null>(null);

    // cache pegawai by id
    const [pegawaiCache, setPegawaiCache] = useState<Map<string, MasterPegawaiLite>>(new Map());

    const upsertPegawaiCache = useCallback((row: MasterPegawaiLite) => {
        if (!row?.pegawai_id) return;
        setPegawaiCache((prev) => {
            const next = new Map(prev);
            const old = next.get(row.pegawai_id);
            next.set(row.pegawai_id, { ...old, ...row });
            return next;
        });
    }, []);

    const deletePegawaiCache = useCallback((pegawai_id: string) => {
        setPegawaiCache((prev) => {
            const next = new Map(prev);
            next.delete(pegawai_id);
            return next;
        });
    }, []);

    // Search / filter
    const [query, setQuery] = useState("");
    const [fStatus, setFStatus] = useState<StatusKontrak | "all">("all");
    const [fTipe, setFTipe] = useState<TipeKontrak | "all">("all");

    // Pagination
    const PAGE_SIZE = 10;
    const [page, setPage] = useState(1);

    // Modal/form
    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    /* ===========================
       LOAD initial data
       =========================== */

    useEffect(() => {
        let alive = true;
        const ac = new AbortController();

        (async () => {
            try {
                setRowsError(null);
                setLoadingRows(true);

                // vendor belum ada endpoint -> biarkan kosong
                setVendorOptions([]);

                const data = await apiListKontrakKerja({ limit: 200, offset: 0, signal: ac.signal });
                if (!alive) return;

                setRows(Array.isArray(data) ? data : []);
            } catch (e: any) {
                if (!alive) return;
                setRowsError(e?.message ?? "Gagal memuat kontrak kerja");
            } finally {
                if (alive) setLoadingRows(false);
            }
        })();

        return () => {
            alive = false;
            ac.abort();
        };
    }, []);

    /* ===========================
       Prefetch pegawai names untuk rows yang sudah ada
       (supaya tabel gak banyak "(Nama belum termuat)")
       =========================== */
    const requestedPegawaiRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (rows.length === 0) return;

        const ac = new AbortController();
        let alive = true;

        const ids = Array.from(new Set(rows.map((r) => r.pegawai_id).filter(Boolean)));
        const missing = ids.filter((id) => !pegawaiCache.has(id) && !requestedPegawaiRef.current.has(id));

        // batasi biar aman (mis. 50 pertama)
        const queue = missing.slice(0, 50);
        queue.forEach((id) => requestedPegawaiRef.current.add(id));

        // simple concurrency limit
        const CONCURRENCY = 6;
        let idx = 0;

        async function worker() {
            while (alive && idx < queue.length) {
                const id = queue[idx++];
                try {
                    const row = await apiGetPegawaiById(id, ac.signal);
                    if (!alive) return;
                    if (row?.pegawai_id) upsertPegawaiCache(row);
                } catch {
                    // ignore (biar tidak spam error)
                }
            }
        }

        (async () => {
            await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));
        })();

        return () => {
            alive = false;
            ac.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]); // sengaja hanya trigger ketika rows berubah (tidak pada pegawaiCache)

    /* ===========================
       WS: pegawai realtime cache
       =========================== */
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_MASTERPEGAWAI_URL || inferWsUrl("/ws/pegawai");
        if (!wsUrl) return;

        let ws: WebSocket | null = null;
        let alive = true;
        let retry = 0;
        let t: any = null;

        const scheduleReconnect = () => {
            if (!alive) return;
            retry = Math.min(retry + 1, 8);
            const delay = Math.min(1200 * retry, 8000);
            t = setTimeout(connect, delay);
        };

        function connect() {
            if (!alive) return;
            if (t) clearTimeout(t);

            try {
                ws = new WebSocket(wsUrl);
            } catch {
                scheduleReconnect();
                return;
            }

            ws.onopen = () => {
                retry = 0;
            };

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    if (msg?.tipe !== "masterpegawai") return;

                    const event = msg?.event;
                    const payload = msg?.payload ?? {};

                    if (event === "created" || event === "updated") {
                        const row: MasterPegawaiLite = {
                            pegawai_id: String(payload.pegawai_id ?? ""),
                            nik: payload.nik ? String(payload.nik) : undefined,
                            nama_lengkap: payload.nama_lengkap ? String(payload.nama_lengkap) : "",
                        };
                        if (row.pegawai_id && row.nama_lengkap) upsertPegawaiCache(row);
                    }
                    if (event === "deleted") {
                        const id = String(payload.pegawai_id ?? "");
                        if (id) deletePegawaiCache(id);
                    }
                } catch {
                    // ignore parse error
                }
            };

            ws.onclose = () => {
                scheduleReconnect();
            };

            ws.onerror = () => {
                try {
                    ws?.close();
                } catch {}
            };
        }

        connect();
        return () => {
            alive = false;
            if (t) clearTimeout(t);
            try {
                ws?.close();
            } catch {}
        };
    }, [upsertPegawaiCache, deletePegawaiCache]);

    /* ===========================
       WS: kontrak kerja realtime
       =========================== */
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_KONTRAK_URL || inferWsUrl("/ws/kontrakkerja");
        if (!wsUrl) return;

        let ws: WebSocket | null = null;
        let alive = true;
        let retry = 0;
        let t: any = null;

        function upsertKontrak(row: KontrakKerja) {
            setRows((prev) => {
                const idx = prev.findIndex((x) => x.kontrak_id === row.kontrak_id);
                if (idx === -1) return [row, ...prev];
                const next = [...prev];
                next[idx] = row;
                return next;
            });
        }

        const scheduleReconnect = () => {
            if (!alive) return;
            retry = Math.min(retry + 1, 8);
            const delay = Math.min(1200 * retry, 8000);
            t = setTimeout(connect, delay);
        };

        function connect() {
            if (!alive) return;
            if (t) clearTimeout(t);

            try {
                ws = new WebSocket(wsUrl);
            } catch {
                scheduleReconnect();
                return;
            }

            ws.onopen = () => {
                retry = 0;
            };

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    if (msg?.tipe !== "kontrak_kerja") return;

                    const event = msg?.event;
                    const payload = msg?.payload ?? {};

                    if (event === "created" || event === "updated") {
                        upsertKontrak(payload as KontrakKerja);
                    }
                    if (event === "deleted") {
                        const id = String(payload?.kontrak_id ?? "");
                        if (id) setRows((prev) => prev.filter((x) => x.kontrak_id !== id));
                    }
                } catch {
                    // ignore
                }
            };

            ws.onclose = () => {
                scheduleReconnect();
            };

            ws.onerror = () => {
                try {
                    ws?.close();
                } catch {}
            };
        }

        connect();
        return () => {
            alive = false;
            if (t) clearTimeout(t);
            try {
                ws?.close();
            } catch {}
        };
    }, []);

    /* ===========================
       Derived data
       =========================== */

    const stats = useMemo(() => {
        const aktif = rows.filter((r) => r.status_kontrak === "aktif").length;
        const selesai = rows.filter((r) => r.status_kontrak === "selesai").length;
        const putus = rows.filter((r) => r.status_kontrak === "putus").length;

        const endingSoon = rows.filter((r) => {
            if (r.status_kontrak !== "aktif") return false;
            const d = daysUntil(r.akhir_kontrak);
            return d != null && d >= 0 && d <= 14;
        }).length;

        return { aktif, selesai, putus, endingSoon };
    }, [rows]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return rows
            .filter((r) => (fStatus === "all" ? true : r.status_kontrak === fStatus))
            .filter((r) => (fTipe === "all" ? true : r.tipe_kontrak === fTipe))
            .filter((r) => {
                if (!q) return true;

                const pegName = (pegawaiCache.get(r.pegawai_id)?.nama_lengkap ?? "").toLowerCase();
                const vendorName = "";

                const hay = [
                    r.kontrak_id,
                    r.pegawai_id,
                    pegName,
                    r.vendor_id || "",
                    vendorName,
                    r.tipe_kontrak,
                    r.jabatan,
                    r.kategori_pekerja,
                    r.status_kontrak,
                    r.lokasi_penempatan_default || "",
                ]
                    .join(" ")
                    .toLowerCase();

                return hay.includes(q);
            })
            .sort((a, b) => (a.mulai_kontrak < b.mulai_kontrak ? 1 : a.mulai_kontrak > b.mulai_kontrak ? -1 : 0));
    }, [rows, query, fStatus, fTipe, pegawaiCache]);

    useEffect(() => {
        setPage(1);
    }, [query, fStatus, fTipe]);

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const startIndex = (clampedPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
    const paged = filtered.slice(startIndex, endIndex);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalPages]);

    /* ===========================
       Form helpers
       =========================== */

    function openCreate() {
        setMode("create");
        setFormError(null);
        setForm(emptyForm());
        setModalOpen(true);
    }

    function openEdit(row: KontrakKerja) {
        setMode("edit");
        setFormError(null);

        const enableHarian = row.upah_harian_default != null;
        const enableMingguan = row.upah_mingguan_default != null;
        const enableBulanan = row.upah_bulanan_default != null;
        const fallbackBulanan = !enableHarian && !enableMingguan && !enableBulanan;

        setForm({
            kontrak_id: row.kontrak_id,
            pegawai_id: row.pegawai_id,
            vendor_id: row.vendor_id || "",
            tipe_kontrak: row.tipe_kontrak,
            jabatan: row.jabatan,
            kategori_pekerja: row.kategori_pekerja,
            mulai_kontrak: row.mulai_kontrak,
            akhir_kontrak: row.akhir_kontrak || "",
            status_kontrak: row.status_kontrak,

            enable_upah_harian: enableHarian,
            enable_upah_mingguan: enableMingguan,
            enable_upah_bulanan: enableBulanan || fallbackBulanan,

            upah_harian_default: row.upah_harian_default,
            upah_mingguan_default: row.upah_mingguan_default,
            upah_bulanan_default: row.upah_bulanan_default,

            lokasi_penempatan_default: row.lokasi_penempatan_default || "",
            dokumen_kontrak_url: row.dokumen_kontrak_url || "",
        });

        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setFormError(null);
    }

    function updateForm<K extends keyof FormState>(key: K, val: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    function normalizeUpah(f: FormState) {
        const out: FormState = { ...f };
        if (!out.enable_upah_harian) out.upah_harian_default = undefined;
        if (!out.enable_upah_mingguan) out.upah_mingguan_default = undefined;
        if (!out.enable_upah_bulanan) out.upah_bulanan_default = undefined;
        return out;
    }

    function validateForm(f: FormState) {
        if (!f.kontrak_id.trim()) return "Kontrak ID tidak valid.";
        if (!f.pegawai_id.trim()) return "Pegawai wajib dipilih (cari nama).";
        if (!f.tipe_kontrak) return "Tipe kontrak wajib dipilih.";
        if (!f.jabatan.trim()) return "Jabatan wajib diisi.";
        if (!f.kategori_pekerja) return "Kategori pekerja wajib dipilih.";
        if (!f.mulai_kontrak) return "Tanggal mulai kontrak wajib diisi.";
        if (f.akhir_kontrak) {
            if (f.akhir_kontrak < f.mulai_kontrak) return "Akhir kontrak tidak boleh sebelum mulai kontrak.";
        }

        if (!f.enable_upah_harian && !f.enable_upah_mingguan && !f.enable_upah_bulanan) {
            return "Pilih minimal salah satu: Upah Harian / Mingguan / Bulanan (boleh kombinasi).";
        }

        if (f.enable_upah_harian) {
            if (f.upah_harian_default == null || Number.isNaN(f.upah_harian_default)) return "Upah harian wajib diisi.";
            if (f.upah_harian_default < 0) return "Upah harian tidak valid.";
        }
        if (f.enable_upah_mingguan) {
            if (f.upah_mingguan_default == null || Number.isNaN(f.upah_mingguan_default)) return "Upah mingguan wajib diisi.";
            if (f.upah_mingguan_default < 0) return "Upah mingguan tidak valid.";
        }
        if (f.enable_upah_bulanan) {
            if (f.upah_bulanan_default == null || Number.isNaN(f.upah_bulanan_default)) return "Upah bulanan wajib diisi.";
            if (f.upah_bulanan_default < 0) return "Upah bulanan tidak valid.";
        }

        if (f.dokumen_kontrak_url && !/^https?:\/\//i.test(f.dokumen_kontrak_url)) {
            return "Dokumen kontrak URL harus diawali http:// atau https://";
        }
        return null;
    }

    async function saveForm() {
        const normalized = normalizeUpah(form);
        const err = validateForm(normalized);
        if (err) {
            setFormError(err);
            return;
        }

        setSaving(true);
        setFormError(null);

        try {
            const payload = {
                kontrak_id: normalized.kontrak_id,
                pegawai_id: normalized.pegawai_id,
                vendor_id: normalized.vendor_id?.trim() ? normalized.vendor_id.trim() : null,

                tipe_kontrak: normalized.tipe_kontrak,
                jabatan: normalized.jabatan.trim(),
                kategori_pekerja: normalized.kategori_pekerja,

                mulai_kontrak: normalized.mulai_kontrak,
                akhir_kontrak: normalized.akhir_kontrak?.trim() ? normalized.akhir_kontrak.trim() : null,

                status_kontrak: normalized.status_kontrak,

                upah_harian_default: normalized.upah_harian_default ?? null,
                upah_mingguan_default: normalized.upah_mingguan_default ?? null,
                upah_bulanan_default: normalized.upah_bulanan_default ?? null,

                lokasi_penempatan_default: normalized.lokasi_penempatan_default?.trim()
                    ? normalized.lokasi_penempatan_default.trim()
                    : null,

                dokumen_kontrak_url: normalized.dokumen_kontrak_url?.trim() ? normalized.dokumen_kontrak_url.trim() : null,
            };

            if (mode === "create") {
                const created = await apiCreateKontrakKerja(payload);
                setRows((prev) => {
                    if (prev.some((x) => x.kontrak_id === created.kontrak_id)) return prev;
                    return [created, ...prev];
                });
            } else {
                const updated = await apiUpdateKontrakKerja(normalized.kontrak_id, {
                    pegawai_id: normalized.pegawai_id,
                    vendor_id: normalized.vendor_id?.trim() ? normalized.vendor_id.trim() : null,
                    tipe_kontrak: normalized.tipe_kontrak,
                    jabatan: normalized.jabatan.trim(),
                    kategori_pekerja: normalized.kategori_pekerja,
                    mulai_kontrak: normalized.mulai_kontrak,
                    akhir_kontrak: normalized.akhir_kontrak?.trim() ? normalized.akhir_kontrak.trim() : null,
                    status_kontrak: normalized.status_kontrak,
                    upah_harian_default: normalized.upah_harian_default ?? null,
                    upah_mingguan_default: normalized.upah_mingguan_default ?? null,
                    upah_bulanan_default: normalized.upah_bulanan_default ?? null,
                    lokasi_penempatan_default: normalized.lokasi_penempatan_default?.trim()
                        ? normalized.lokasi_penempatan_default.trim()
                        : null,
                    dokumen_kontrak_url: normalized.dokumen_kontrak_url?.trim() ? normalized.dokumen_kontrak_url.trim() : null,
                });

                setRows((prev) => prev.map((x) => (x.kontrak_id === updated.kontrak_id ? updated : x)));
            }

            closeModal();
        } catch (e: any) {
            setFormError(e?.message ?? "Gagal menyimpan kontrak");
        } finally {
            setSaving(false);
        }
    }

    async function deleteRow(kontrak_id: string) {
        if (!confirm(`Hapus kontrak ${kontrak_id}?`)) return;
        try {
            await apiDeleteKontrakKerja(kontrak_id);
            setRows((prev) => prev.filter((r) => r.kontrak_id !== kontrak_id));
        } catch (e: any) {
            alert(e?.message ?? "Gagal menghapus kontrak");
        }
    }

    async function endContract(kontrak_id: string) {
        if (!confirm(`Set status kontrak ${kontrak_id} menjadi "selesai"?`)) return;
        try {
            const today = new Date().toISOString().slice(0, 10);
            const updated = await apiUpdateKontrakKerja(kontrak_id, {
                status_kontrak: "selesai",
                akhir_kontrak: today,
            });
            setRows((prev) => prev.map((x) => (x.kontrak_id === updated.kontrak_id ? updated : x)));
        } catch (e: any) {
            alert(e?.message ?? "Gagal menyelesaikan kontrak");
        }
    }

    function exportCSV() {
        const headers = [
            "kontrak_id",
            "pegawai_id",
            "vendor_id",
            "tipe_kontrak",
            "jabatan",
            "kategori_pekerja",
            "mulai_kontrak",
            "akhir_kontrak",
            "status_kontrak",
            "upah_harian_default",
            "upah_mingguan_default",
            "upah_bulanan_default",
            "lokasi_penempatan_default",
            "dokumen_kontrak_url",
            "created_at",
            "updated_at",
        ];

        const csv = [
            headers.join(","),
            ...filtered.map((r) =>
                headers
                    .map((h) => {
                        // @ts-ignore
                        const v = r[h] ?? "";
                        const s = String(v).replaceAll('"', '""');
                        return `"${s}"`;
                    })
                    .join(",")
            ),
        ].join("\r\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kontrak_kerja_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function toggleUpah(key: "harian" | "mingguan" | "bulanan") {
        setFormError(null);
        setForm((prev) => {
            const enabledCount =
                Number(prev.enable_upah_harian) + Number(prev.enable_upah_mingguan) + Number(prev.enable_upah_bulanan);
            const next = { ...prev };

            if (key === "harian") {
                const willOff = prev.enable_upah_harian;
                if (willOff && enabledCount === 1) {
                    setFormError("Minimal satu pilihan upah harus aktif.");
                    return prev;
                }
                next.enable_upah_harian = !prev.enable_upah_harian;
                if (!next.enable_upah_harian) next.upah_harian_default = undefined;
                return next;
            }

            if (key === "mingguan") {
                const willOff = prev.enable_upah_mingguan;
                if (willOff && enabledCount === 1) {
                    setFormError("Minimal satu pilihan upah harus aktif.");
                    return prev;
                }
                next.enable_upah_mingguan = !prev.enable_upah_mingguan;
                if (!next.enable_upah_mingguan) next.upah_mingguan_default = undefined;
                return next;
            }

            const willOff = prev.enable_upah_bulanan;
            if (willOff && enabledCount === 1) {
                setFormError("Minimal satu pilihan upah harus aktif.");
                return prev;
            }
            next.enable_upah_bulanan = !prev.enable_upah_bulanan;
            if (!next.enable_upah_bulanan) next.upah_bulanan_default = undefined;
            return next;
        });
    }

    function goFirst() {
        setPage(1);
    }
    function goPrev() {
        setPage((p) => Math.max(1, p - 1));
    }
    function goNext() {
        setPage((p) => Math.min(totalPages, p + 1));
    }
    function goLast() {
        setPage(totalPages);
    }

    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 overflow-hidden text-slate-800">
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-5 md:p-8 max-w-6xl mx-auto w-full">
                        {/* Title */}
                        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <IdCard className="w-3.5 h-3.5" />
                        Dashboard
                      </span>
                                            <span className="text-slate-300">/</span>
                                            <span>Pegawai</span>
                                            <span className="text-slate-300">/</span>
                                            <span className="text-slate-700 font-medium">Kontrak Kerja</span>
                                        </div>
                                        <h1 className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">Manajemen Kontrak Kerja</h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Data disimpan di PostgreSQL (Rust Actix). Realtime update via WebSocket.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <button
                                        onClick={openCreate}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Tambah Kontrak
                                    </button>

                                    <button
                                        onClick={exportCSV}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        title="Export CSV"
                                    >
                                        <Download className="h-4 w-4" />
                                        Export
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Kontrak Aktif" value={stats.aktif} icon={<BadgeCheck className="w-5 h-5" />} hint="Masih berjalan" />
                            <StatCard title="Berakhir ≤ 14 hari" value={stats.endingSoon} icon={<Calendar className="w-5 h-5" />} hint="Perlu follow-up" />
                            <StatCard title="Selesai" value={stats.selesai} icon={<CircleSlash className="w-5 h-5" />} hint="Kontrak ditutup" />
                            <StatCard title="Putus" value={stats.putus} icon={<CircleSlash className="w-5 h-5" />} hint="Diputus" />
                        </div>

                        {/* Table */}
                        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 p-4 md:p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="relative w-full lg:max-w-md">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Cari kontrak (ID, nama pegawai, jabatan, lokasi, status...)"
                                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:ring-4 focus:ring-slate-200/60"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                                            <Filter className="h-4 w-4" />
                                            Filter
                                        </div>

                                        <MiniSelect
                                            label="Status"
                                            value={fStatus}
                                            onChange={(v) => setFStatus(v as any)}
                                            options={[{ value: "all", label: "Semua" }, ...STATUS_KONTRAK.map((s) => ({ value: s, label: s }))]}
                                        />
                                        <MiniSelect
                                            label="Tipe"
                                            value={fTipe}
                                            onChange={(v) => setFTipe(v as any)}
                                            options={[{ value: "all", label: "Semua" }, ...TIPE_KONTRAK.map((t) => ({ value: t, label: t }))]}
                                        />
                                    </div>
                                </div>

                                {loadingRows ? (
                                    <div className="mt-3 text-xs text-slate-500">Memuat data dari server…</div>
                                ) : rowsError ? (
                                    <div className="mt-3 text-xs text-rose-700">{rowsError}</div>
                                ) : null}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-max min-w-[1600px] text-sm table-auto">
                                    <colgroup>
                                        <col style={{ width: 260 }} />
                                        <col style={{ width: 320 }} />
                                        <col style={{ width: 280 }} />
                                        <col style={{ width: 160 }} />
                                        <col style={{ width: 200 }} />
                                        <col style={{ width: 280 }} />
                                        <col style={{ width: 420 }} />
                                        <col style={{ width: 160 }} />
                                        <col style={{ width: 180 }} />
                                    </colgroup>

                                    <thead>
                                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Kontrak</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Pegawai</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Vendor</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Tipe</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Jabatan</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Periode</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Upah Default</th>
                                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Status</th>
                                        <th className="px-5 py-3 font-semibold text-right whitespace-nowrap">Aksi</th>
                                    </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                    {paged.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                                                Tidak ada data yang cocok dengan filter/pencarian.
                                            </td>
                                        </tr>
                                    ) : (
                                        paged.map((r) => {
                                            const pegName = pegawaiCache.get(r.pegawai_id)?.nama_lengkap || "(Nama belum termuat)";
                                            const venName = r.vendor_id ? r.vendor_id : "";
                                            const due = daysUntil(r.akhir_kontrak);

                                            const dueBadge =
                                                r.status_kontrak === "aktif" && due != null && due >= 0 && due <= 14
                                                    ? { text: `Berakhir ${due} hari`, tone: dueTone(due) }
                                                    : null;

                                            const wages = getWageChips(r);

                                            return (
                                                <tr key={r.kontrak_id} className="hover:bg-slate-50/60 transition">
                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="font-semibold text-slate-900">{r.kontrak_id}</div>

                                                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 whitespace-nowrap">
                                <span
                                    className="inline-flex items-center gap-1 max-w-[260px] truncate"
                                    title={r.lokasi_penempatan_default || "-"}
                                >
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{r.lokasi_penempatan_default || "-"}</span>
                                </span>

                                                            {r.dokumen_kontrak_url ? (
                                                                <a
                                                                    href={r.dokumen_kontrak_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 text-slate-700 underline decoration-slate-300 hover:text-slate-900"
                                                                    title="Buka dokumen kontrak"
                                                                >
                                                                    <LinkIcon className="h-3.5 w-3.5" />
                                                                    Dokumen
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-2">
                                                            <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
                                                                <User className="h-4 w-4 text-slate-700" />
                                                            </div>
                                                            <div className="font-semibold text-slate-900">
                                                                {pegName}{" "}
                                                                <span className="text-xs font-medium text-slate-500">({r.pegawai_id})</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-2">
                                                            <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
                                                                <Building2 className="h-4 w-4 text-slate-700" />
                                                            </div>
                                                            <div className="text-slate-700">
                                                                {venName ? venName : <span className="text-slate-500">-</span>}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="font-medium text-slate-800">{r.tipe_kontrak}</div>
                                                        <div className="text-xs text-slate-500">{r.kategori_pekerja}</div>
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="font-medium text-slate-800">{r.jabatan}</div>
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="text-slate-800">
                                                            {formatDate(r.mulai_kontrak)} <span className="text-slate-400">→</span>{" "}
                                                            {r.akhir_kontrak ? formatDate(r.akhir_kontrak) : "Open"}
                                                        </div>

                                                        {dueBadge ? (
                                                            <div
                                                                className={cn(
                                                                    "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 whitespace-nowrap",
                                                                    dueBadge.tone
                                                                )}
                                                            >
                                                                {dueBadge.text}
                                                            </div>
                                                        ) : null}
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-2" title={wagesTooltip(r)}>
                                                            <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
                                                                <Wallet className="h-4 w-4 text-slate-700" />
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 whitespace-nowrap">
                                                                {wages.map((w) => (
                                                                    <span
                                                                        key={w.label}
                                                                        className={cn(
                                                                            "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                                                                            w.value != null
                                                                                ? "bg-slate-900 text-white ring-slate-900"
                                                                                : "bg-slate-50 text-slate-600 ring-slate-200"
                                                                        )}
                                                                    >
                                      <span className="text-[11px] font-semibold">{w.label}</span>
                                      <span
                                          className={cn(
                                              "text-[11px]",
                                              w.value != null ? "text-white/90" : "text-slate-500"
                                          )}
                                      >
                                        {w.value != null ? toIDR(w.value) : "-"}
                                      </span>
                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                              <span
                                  className={cn(
                                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                                      chipTone(r.status_kontrak)
                                  )}
                              >
                                {r.status_kontrak}
                              </span>
                                                    </td>

                                                    <td className="px-5 py-4 align-top whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <IconButton title="Edit" onClick={() => openEdit(r)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </IconButton>

                                                            {r.status_kontrak === "aktif" ? (
                                                                <IconButton title="Selesaikan kontrak" onClick={() => endContract(r.kontrak_id)}>
                                                                    <CircleSlash className="h-4 w-4" />
                                                                </IconButton>
                                                            ) : null}

                                                            <IconButton title="Hapus" danger onClick={() => deleteRow(r.kontrak_id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </IconButton>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination bar */}
                            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                <div className="text-xs text-slate-500">
                                    Menampilkan{" "}
                                    <span className="font-semibold text-slate-700">
                    {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
                  </span>{" "}
                                    dari <span className="font-semibold text-slate-700">{totalItems}</span> kontrak.
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                    <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                                        Halaman <span className="font-semibold text-slate-700">{clampedPage}</span> dari{" "}
                                        <span className="font-semibold text-slate-700">{totalPages}</span>
                                    </div>

                                    <div className="inline-flex items-center gap-1">
                                        <PagerButton title="Halaman pertama" onClick={goFirst} disabled={clampedPage === 1}>
                                            <ChevronsLeft className="h-4 w-4" />
                                        </PagerButton>
                                        <PagerButton title="Sebelumnya" onClick={goPrev} disabled={clampedPage === 1}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </PagerButton>

                                        <div className="mx-1 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                            {clampedPage}
                                        </div>

                                        <PagerButton title="Berikutnya" onClick={goNext} disabled={clampedPage === totalPages}>
                                            <ChevronRight className="h-4 w-4" />
                                        </PagerButton>
                                        <PagerButton title="Halaman terakhir" onClick={goLast} disabled={clampedPage === totalPages}>
                                            <ChevronsRight className="h-4 w-4" />
                                        </PagerButton>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal */}
                        {modalOpen ? (
                            <div className="fixed inset-0 z-50">
                                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
                                <div className="absolute inset-0 flex items-end justify-center p-3 sm:items-center sm:p-6">
                                    <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="rounded-2xl bg-slate-900 p-2.5 text-white">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500">sbpv3.t_kontrak_kerja</div>
                                                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                                                        {mode === "create" ? "Tambah Kontrak" : "Edit Kontrak"}
                                                    </h2>
                                                </div>
                                            </div>

                                            <button
                                                onClick={closeModal}
                                                className="rounded-2xl p-2 text-slate-600 hover:bg-slate-100"
                                                aria-label="Tutup"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>

                                        <div className="p-5">
                                            {formError ? (
                                                <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-100">
                                                    {formError}
                                                </div>
                                            ) : null}

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <Field label="Kontrak ID (readonly)" icon={<IdCard className="h-4 w-4" />}>
                                                    <div className="relative">
                                                        <input
                                                            value={form.kontrak_id}
                                                            readOnly
                                                            className="w-full cursor-not-allowed rounded-2xl bg-slate-100 px-4 py-2.5 pr-10 text-sm text-slate-700 ring-1 ring-slate-200 outline-none"
                                                        />
                                                        <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                                                    </div>
                                                </Field>

                                                {/* Pegawai picker */}
                                                <Field label="Pegawai (cari nama)" icon={<User className="h-4 w-4" />}>
                                                    <PegawaiAsyncSelect
                                                        value={form.pegawai_id}
                                                        onChange={(id) => updateForm("pegawai_id", id)}
                                                        cacheById={pegawaiCache}
                                                        onCacheUpsert={upsertPegawaiCache}
                                                        placeholder="Ketik nama pegawai (mis. Budi)..."
                                                    />
                                                    <div className="mt-1 text-[11px] text-slate-500">
                                                        Disimpan: <span className="font-semibold">{form.pegawai_id || "-"}</span>
                                                    </div>
                                                </Field>

                                                {/* Vendor (opsional) */}
                                                <Field
                                                    label={vendorOptions.length ? "Vendor (opsional)" : "Vendor ID (opsional)"}
                                                    icon={<Building2 className="h-4 w-4" />}
                                                >
                                                    {vendorOptions.length ? (
                                                        <select
                                                            value={form.vendor_id || ""}
                                                            onChange={(e) => updateForm("vendor_id", e.target.value)}
                                                            className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                        >
                                                            <option value="">(Tidak ada) - pegawai internal</option>
                                                            {vendorOptions.map((v) => (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.nama} ({v.id})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            value={form.vendor_id || ""}
                                                            onChange={(e) => updateForm("vendor_id", e.target.value)}
                                                            className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                            placeholder="Kosongkan bila internal"
                                                        />
                                                    )}
                                                </Field>

                                                <Field label="Tipe Kontrak" icon={<BadgeCheck className="h-4 w-4" />}>
                                                    <select
                                                        value={form.tipe_kontrak}
                                                        onChange={(e) => updateForm("tipe_kontrak", e.target.value as TipeKontrak)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                    >
                                                        {TIPE_KONTRAK.map((t) => (
                                                            <option key={t} value={t}>
                                                                {t}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </Field>

                                                <Field label="Jabatan" icon={<IdCard className="h-4 w-4" />}>
                                                    <input
                                                        value={form.jabatan}
                                                        onChange={(e) => updateForm("jabatan", e.target.value)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                        placeholder="Mandor / Tukang / Helper / Operator / ..."
                                                    />
                                                </Field>

                                                <Field label="Kategori Pekerja" icon={<BadgeCheck className="h-4 w-4" />}>
                                                    <select
                                                        value={form.kategori_pekerja}
                                                        onChange={(e) => updateForm("kategori_pekerja", e.target.value as KategoriPekerja)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                    >
                                                        {KATEGORI.map((k) => (
                                                            <option key={k} value={k}>
                                                                {k}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </Field>

                                                <Field label="Mulai Kontrak" icon={<Calendar className="h-4 w-4" />}>
                                                    <input
                                                        type="date"
                                                        value={form.mulai_kontrak}
                                                        onChange={(e) => updateForm("mulai_kontrak", e.target.value)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                    />
                                                </Field>

                                                <Field label="Akhir Kontrak (opsional)" icon={<Calendar className="h-4 w-4" />}>
                                                    <input
                                                        type="date"
                                                        value={form.akhir_kontrak || ""}
                                                        onChange={(e) => updateForm("akhir_kontrak", e.target.value)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                    />
                                                </Field>

                                                <Field label="Status" icon={<CircleSlash className="h-4 w-4" />}>
                                                    <select
                                                        value={form.status_kontrak}
                                                        onChange={(e) => updateForm("status_kontrak", e.target.value as StatusKontrak)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                    >
                                                        {STATUS_KONTRAK.map((s) => (
                                                            <option key={s} value={s}>
                                                                {s}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </Field>

                                                {/* Upah selector */}
                                                <div className="md:col-span-2">
                                                    <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                            <div className="flex items-start gap-3">
                                                                <div className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
                                                                    <Wallet className="h-5 w-5 text-slate-700" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-bold text-slate-900">Upah Default</div>
                                                                    <div className="text-xs text-slate-600">
                                                                        Pilih Harian / Mingguan / Bulanan (boleh kombinasi).
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2">
                                                                <TogglePill label="Harian" checked={form.enable_upah_harian} onClick={() => toggleUpah("harian")} />
                                                                <TogglePill label="Mingguan" checked={form.enable_upah_mingguan} onClick={() => toggleUpah("mingguan")} />
                                                                <TogglePill label="Bulanan" checked={form.enable_upah_bulanan} onClick={() => toggleUpah("bulanan")} />
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                                                            <Field label="Upah Harian (IDR)" icon={<Wallet className="h-4 w-4" />}>
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={form.enable_upah_harian ? form.upah_harian_default ?? "" : ""}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        updateForm("upah_harian_default", v === "" ? undefined : Number(v));
                                                                    }}
                                                                    disabled={!form.enable_upah_harian}
                                                                    min={0}
                                                                    placeholder="150000"
                                                                    className={cn(
                                                                        "w-full rounded-2xl px-4 py-2.5 text-sm ring-1 outline-none focus:ring-4",
                                                                        form.enable_upah_harian
                                                                            ? "bg-white text-slate-800 ring-slate-200 focus:ring-slate-200/60"
                                                                            : "cursor-not-allowed bg-slate-100 text-slate-500 ring-slate-200"
                                                                    )}
                                                                />
                                                                <div className="mt-1 text-[11px] text-slate-500">
                                                                    Preview: {form.enable_upah_harian ? toIDR(form.upah_harian_default) : "-"}
                                                                </div>
                                                            </Field>

                                                            <Field label="Upah Mingguan (IDR)" icon={<Wallet className="h-4 w-4" />}>
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={form.enable_upah_mingguan ? form.upah_mingguan_default ?? "" : ""}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        updateForm("upah_mingguan_default", v === "" ? undefined : Number(v));
                                                                    }}
                                                                    disabled={!form.enable_upah_mingguan}
                                                                    min={0}
                                                                    placeholder="900000"
                                                                    className={cn(
                                                                        "w-full rounded-2xl px-4 py-2.5 text-sm ring-1 outline-none focus:ring-4",
                                                                        form.enable_upah_mingguan
                                                                            ? "bg-white text-slate-800 ring-slate-200 focus:ring-slate-200/60"
                                                                            : "cursor-not-allowed bg-slate-100 text-slate-500 ring-slate-200"
                                                                    )}
                                                                />
                                                                <div className="mt-1 text-[11px] text-slate-500">
                                                                    Preview: {form.enable_upah_mingguan ? toIDR(form.upah_mingguan_default) : "-"}
                                                                </div>
                                                            </Field>

                                                            <Field label="Upah Bulanan (IDR)" icon={<Wallet className="h-4 w-4" />}>
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={form.enable_upah_bulanan ? form.upah_bulanan_default ?? "" : ""}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        updateForm("upah_bulanan_default", v === "" ? undefined : Number(v));
                                                                    }}
                                                                    disabled={!form.enable_upah_bulanan}
                                                                    min={0}
                                                                    placeholder="6500000"
                                                                    className={cn(
                                                                        "w-full rounded-2xl px-4 py-2.5 text-sm ring-1 outline-none focus:ring-4",
                                                                        form.enable_upah_bulanan
                                                                            ? "bg-white text-slate-800 ring-slate-200 focus:ring-slate-200/60"
                                                                            : "cursor-not-allowed bg-slate-100 text-slate-500 ring-slate-200"
                                                                    )}
                                                                />
                                                                <div className="mt-1 text-[11px] text-slate-500">
                                                                    Preview: {form.enable_upah_bulanan ? toIDR(form.upah_bulanan_default) : "-"}
                                                                </div>
                                                            </Field>
                                                        </div>

                                                        <div className="mt-3 text-xs text-slate-600">
                                                            <span className="font-semibold text-slate-800">Validasi:</span> Minimal 1 pilihan upah aktif.
                                                        </div>
                                                    </div>
                                                </div>

                                                <Field label="Lokasi Penempatan Default (opsional)" icon={<MapPin className="h-4 w-4" />}>
                                                    <input
                                                        value={form.lokasi_penempatan_default || ""}
                                                        onChange={(e) => updateForm("lokasi_penempatan_default", e.target.value)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                        placeholder="Proyek A - Malang"
                                                    />
                                                </Field>

                                                <Field label="Dokumen Kontrak URL (opsional)" icon={<LinkIcon className="h-4 w-4" />}>
                                                    <input
                                                        value={form.dokumen_kontrak_url || ""}
                                                        onChange={(e) => updateForm("dokumen_kontrak_url", e.target.value)}
                                                        className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-4 focus:ring-slate-200/60"
                                                        placeholder="https://..."
                                                    />
                                                </Field>
                                            </div>

                                            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="text-xs text-slate-500">
                                                    {mode === "create" ? "Kontrak ID dibuat otomatis." : "Kontrak ID tidak dapat diubah."}
                                                </div>

                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={closeModal}
                                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                                        disabled={saving}
                                                    >
                                                        Batal
                                                    </button>
                                                    <button
                                                        onClick={saveForm}
                                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                                                        disabled={saving}
                                                    >
                                                        {mode === "create" ? (
                                                            <>
                                                                <Plus className="h-4 w-4" />
                                                                {saving ? "Menyimpan..." : "Simpan"}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Pencil className="h-4 w-4" />
                                                                {saving ? "Mengupdate..." : "Update"}
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
}

/* --------------------------
 * Small UI components
 * -------------------------- */

function StatCard({
                      title,
                      value,
                      hint,
                      icon,
                  }: {
    title: string;
    value: number;
    hint: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs text-slate-500">{title}</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
                    <div className="mt-1 text-xs text-slate-500">{hint}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-2.5 text-slate-700 ring-1 ring-slate-200">{icon}</div>
            </div>
        </div>
    );
}

function IconButton({
                        children,
                        title,
                        danger,
                        onClick,
                    }: {
    children: React.ReactNode;
    title: string;
    danger?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                "rounded-2xl p-2 ring-1 shadow-sm transition",
                danger ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    );
}

function PagerButton({
                         children,
                         title,
                         disabled,
                         onClick,
                     }: {
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold ring-1 transition",
                disabled ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-slate-200" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="text-slate-500">{icon}</span>
                {label}
            </div>
            {children}
        </div>
    );
}

function MiniSelect({
                        label,
                        value,
                        onChange,
                        options,
                    }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <label className="inline-flex items-center gap-2">
            <span className="text-xs text-slate-500">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none hover:bg-slate-50 focus:ring-4 focus:ring-slate-200/60"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function TogglePill({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "select-none rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                checked ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            )}
            aria-pressed={checked}
        >
      <span className={cn("mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full", checked ? "bg-white/15" : "bg-slate-100")}>
        <span className={cn("h-2 w-2 rounded-full", checked ? "bg-emerald-400" : "bg-slate-300")} />
      </span>
            {label}
        </button>
    );
}
