// /src/app/dashboard/stokgudang/InventoryDashboardClient.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Package,
    BarChart2,
    TrendingUp,
    Clock,
    Calendar,
    Search,
    ChevronDown,
    ArrowUpDown,
} from "lucide-react";

import {
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface StockItem {
    id: number;
    kode: string;
    nama: string;
    brand: string;
    kategori: string;
    harga_idr: number;
    stok_sisa: number;
    satuan_nama: string;
    lokasi: string;
    // optional field dari backend (sbpv3.stok)
    tanggal_masuk?: string | null;
    created_at?: string | null;
}

interface Movement {
    id: number;
    stok_id: number;
    jenis: string; // "MASUK" | "KELUAR"
    qty: number;
    satuan_id: number;
    sumber_tujuan?: string;
    keterangan?: string;
    created_at: string;
    // optional → akan diisi kalau dari batch-in yang pakai enum jenis_pemasukan
    jenis_pemasukan?: string | null; // contoh: "PEMBELIAN_PO" | "RETUR_BARANG"
}

interface Props {
    initialStocks: StockItem[];
    initialMovements: Movement[];
}

// Helper format Rupiah full
const formatIDR = (value: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

// Helper format Rupiah compact (untuk axis)
const formatIDRCompact = (value: number) =>
    new Intl.NumberFormat("id-ID", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);

// Helper format datetime Waktu Indonesia Barat
const formatDateTimeWIB = (value: string) => {
    if (!value) return "-";
    try {
        const formatted = new Date(value).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        return `${formatted} WIB`;
    } catch {
        return value;
    }
};

// ====== VISUALISASI DATA STOK (BAR CHART) ======
const StockValueChart = ({ stocks }: { stocks: StockItem[] }) => {
    const data = useMemo(() => {
        const enriched = stocks
            .map((s) => ({
                kode: s.kode,
                nama: s.nama,
                stok_sisa: s.stok_sisa,
                satuan_nama: s.satuan_nama,
                harga_idr: s.harga_idr,
                nilai: s.stok_sisa * s.harga_idr,
            }))
            .filter((d) => d.nilai > 0 || d.stok_sisa > 0);

        enriched.sort((a, b) => b.nilai - a.nilai); // terbesar dulu
        return enriched.slice(0, 10); // top 10
    }, [stocks]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;
        const item = payload[0].payload;

        return (
            <div className="rounded-xl bg-white/95 shadow-lg border border-slate-200 px-4 py-3 text-xs space-y-1 max-w-xs">
                <p className="font-semibold text-slate-800">
                    {item.kode} — {item.nama}
                </p>
                <p className="text-slate-500">
                    Stok:{" "}
                    <span className="font-semibold">
                        {item.stok_sisa} {item.satuan_nama}
                    </span>
                </p>
                <p className="text-slate-500">
                    Harga Satuan:{" "}
                    <span className="font-semibold">
                        {formatIDR(item.harga_idr)}
                    </span>
                </p>
                <p className="text-slate-800">
                    Nilai Stok:{" "}
                    <span className="font-bold text-indigo-600">
                        {formatIDR(item.nilai)}
                    </span>
                </p>
            </div>
        );
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl h-full">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-500" />
                Visualisasi Data Stok (Top 10 Nilai)
            </h2>

            {data.length === 0 ? (
                <div className="w-full h-[450px] bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px]" />
                    <BarChart2
                        size={48}
                        className="mb-2 opacity-50 text-blue-400 z-10"
                    />
                    <p className="font-medium z-10 text-sm">
                        Belum ada data stok untuk divisualisasikan.
                    </p>
                </div>
            ) : (
                <div className="w-full h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 16, right: 24, left: 8, bottom: 48 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="kode"
                                angle={-35}
                                textAnchor="end"
                                height={60}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis
                                tickFormatter={(v) => formatIDRCompact(v as number)}
                                tick={{ fontSize: 11 }}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend
                                formatter={() => (
                                    <span className="text-xs text-slate-600">
                                        Nilai stok per produk (Rp)
                                    </span>
                                )}
                            />
                            <Bar
                                dataKey="nilai"
                                name="Nilai Stok (Rp)"
                                radius={[8, 8, 0, 0]}
                                fill="#4f46e5"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

// ====== LOG PERGERAKAN STOK ======
const MovementLogCard = ({
    data,
    stocks,
}: {
    data: Movement[];
    stocks: StockItem[];
}) => {
    // pastikan terbaru di atas (kalau backend belum sort)
    const latest10 = [...data]
        .sort(
            (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
        )
        .slice(0, 10);

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex flex-col flex-1">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-pink-500" />
                Log Pergerakan Stok (Realtime)
            </h2>

            {/* Container scroll vertical khusus log */}
            <div className="mt-1 space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {latest10.map((m) => {
                    const jenisUpper = m.jenis?.toUpperCase?.() ?? m.jenis;
                    const masuk = jenisUpper === "MASUK";

                    // cek apakah movement ini retur barang (jenis_pemasukan = RETUR_BARANG)
                    const isReturBarang =
                        masuk &&
                        m.jenis_pemasukan &&
                        m.jenis_pemasukan.toUpperCase() === "RETUR_BARANG";

                    const accentClass = masuk
                        ? isReturBarang
                            ? "bg-orange-500"
                            : "bg-emerald-500"
                        : "bg-red-500";

                    const labelText = masuk
                        ? isReturBarang
                            ? "Retur Barang ke Gudang"
                            : "Masuk Gudang"
                        : "Keluar Gudang";

                    const labelColorClass = masuk
                        ? isReturBarang
                            ? "text-orange-500"
                            : "text-emerald-500"
                        : "text-red-500";

                    const qtyColorClass = masuk
                        ? isReturBarang
                            ? "text-orange-600"
                            : "text-emerald-600"
                        : "text-red-600";

                    // Cari info stok dari daftar stocks berdasarkan stok_id
                    const stokInfo = stocks.find((s) => s.id === m.stok_id);
                    const hargaSatuan = stokInfo?.harga_idr ?? 0;
                    const totalNilai = m.qty * hargaSatuan;
                    const satuanNama = stokInfo?.satuan_nama ?? "";

                    const namaProduk = stokInfo
                        ? `${stokInfo.kode} — ${stokInfo.nama}`
                        : m.keterangan || "Pergerakan Stok";

                    return (
                        <div
                            key={m.id}
                            className="rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                        >
                            {/* Scroll horizontal di level CARD, bukan di teks kode saja */}
                            <div className="px-3 py-2 overflow-x-auto">
                                {/* Konten dibuat min-w-max + whitespace-nowrap supaya bisa di-scroll full */}
                                <div className="flex items-stretch gap-3 min-w-max whitespace-nowrap">
                                    {/* Accent bar */}
                                    <div
                                        className={`w-1.5 rounded-full shrink-0 ${accentClass}`}
                                    />

                                    {/* Content utama */}
                                    <div className="flex-1 min-w-0">
                                        {/* Baris 1: Nama produk & qty */}
                                        <div className="flex items-start justify-between gap-3">
                                            {/* Kode + nama produk FULL */}
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {namaProduk}
                                                </span>
                                            </div>

                                            <span
                                                className={`text-xs sm:text-sm font-extrabold shrink-0 ${qtyColorClass}`}
                                            >
                                                {masuk ? "+" : "-"}
                                                {m.qty}{" "}
                                                {satuanNama && (
                                                    <span className="font-normal text-slate-600 ml-0.5">
                                                        {satuanNama}
                                                    </span>
                                                )}
                                            </span>
                                        </div>

                                        {/* Baris 2: Info arah + harga & nilai */}
                                        <div className="mt-0.5 flex flex-col gap-0.5 text-xs">
                                            <span className={`font-medium ${labelColorClass}`}>
                                                {labelText}
                                                {m.sumber_tujuan
                                                    ? ` • ${m.sumber_tujuan}`
                                                    : ""}
                                            </span>

                                            {stokInfo ? (
                                                <span className="text-[11px] text-slate-500">
                                                    Harga:{" "}
                                                    <span className="font-semibold">
                                                        {formatIDR(hargaSatuan)}
                                                    </span>{" "}
                                                    {satuanNama && `/ ${satuanNama}`} • Total:{" "}
                                                    <span className="font-semibold">
                                                        {formatIDR(totalNilai)}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-slate-400">
                                                    Detail produk tidak ditemukan (stok_id:{" "}
                                                    {m.stok_id})
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Waktu di kanan */}
                                    <div className="shrink-0 flex items-start">
                                        <span className="text-[11px] text-slate-400 text-right">
                                            {formatDateTimeWIB(m.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {latest10.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-4">
                        Belum ada pergerakan stok.
                    </div>
                )}
            </div>
        </div>
    );
};

// ====== SORTING ======
type SortKey =
    | "kode"
    | "nama"
    | "brand"
    | "lokasi"
    | "stok_sisa"
    | "satuan_nama"
    | "harga_idr"
    | "harga_total"
    | "tanggal_masuk"
    | "created_at";

type SortDirection = "asc" | "desc";

export default function InventoryDashboardClient({
    initialStocks,
    initialMovements,
}: Props) {
    const [open, setOpen] = useState(true);
    const [stocks, setStocks] = useState<StockItem[]>(initialStocks);
    const [movements, setMovements] =
        useState<Movement[]>(initialMovements);
    const [search, setSearch] = useState("");
    const [showReturOnly, setShowReturOnly] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // default: produk terbaru di atas → sort by created_at desc
    const [sortConfig, setSortConfig] = useState<{
        key: SortKey;
        direction: SortDirection;
    }>({
        key: "created_at",
        direction: "desc",
    });

    const backendUrl =
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

    const refetchStocks = async () => {
        const res = await fetch(`${backendUrl}/api/stok`, {
            cache: "no-store",
        });
        const data: StockItem[] = await res.json();
        setStocks(data);
    };

    const refetchMovements = async () => {
        const res = await fetch(
            `${backendUrl}/api/stok/movements/recent`,
            {
                cache: "no-store",
            },
        );
        const data: Movement[] = await res.json();
        setMovements(data);
    };

    // Reset halaman kalau keyword berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search, showReturOnly]);

    // WebSocket realtime listener
    useEffect(() => {
        const proto = backendUrl.startsWith("https") ? "wss" : "ws";
        const wsUrl = backendUrl.replace(/^https?/, proto) + "/ws";
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => console.log("✅ WS connected:", wsUrl);
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (!msg?.event) return;

                console.log("📦 WS Event:", msg.event, msg);

                switch (msg.event) {
                    case "movement_created":
                        refetchMovements();
                        refetchStocks();
                        break;
                    case "stok_created":
                    case "stok_updated":
                    case "stok_deleted":
                        refetchStocks();
                        break;
                    case "batch_stock_in":
                        // event khusus dari POST /api/stock-movements/batch-in
                        refetchStocks();
                        refetchMovements();
                        break;
                    default:
                        break;
                }
            } catch {
                // kalau plain text, skip
            }
        };
        ws.onclose = () => console.log("❌ WS disconnected");

        return () => ws.close();
    }, [backendUrl]);

    const handleSort = (key: SortKey) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                // toggle asc/desc
                return {
                    key,
                    direction: prev.direction === "asc" ? "desc" : "asc",
                };
            }

            // default arah untuk kolom baru
            let defaultDirection: SortDirection = "asc";
            if (
                key === "stok_sisa" ||
                key === "harga_idr" ||
                key === "harga_total" ||
                key === "created_at" ||
                key === "tanggal_masuk"
            ) {
                defaultDirection = "desc";
            }

            return { key, direction: defaultDirection };
        });
    };

    const renderSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) {
            return (
                <ArrowUpDown
                    size={14}
                    className="ml-1 text-slate-400 inline-block"
                />
            );
        }

        return (
            <span className="ml-1 text-[10px] text-blue-600 inline-block">
                {sortConfig.direction === "asc" ? "▲" : "▼"}
            </span>
        );
    };

    const isReturStockFn = (item: StockItem) =>
        item.nama?.startsWith("[SISA RETUR]") ?? false;

    // Filter + Sort
    const processed = useMemo(() => {
        let base = [...stocks];

        // search global
        if (search.trim()) {
            const q = search.toLowerCase();
            base = base.filter(
                (s) =>
                    s.kode.toLowerCase().includes(q) ||
                    s.nama.toLowerCase().includes(q) ||
                    s.brand.toLowerCase().includes(q) ||
                    (s.lokasi || "").toLowerCase().includes(q),
            );
        }

        // filter "Sisa Retur" saja
        if (showReturOnly) {
            base = base.filter((s) => isReturStockFn(s));
        }

        // sort
        const { key, direction } = sortConfig;
        const factor = direction === "asc" ? 1 : -1;

        base.sort((a, b) => {
            const numCompare = (av: number, bv: number) =>
                (av - bv) * factor;
            const strCompare = (av: string, bv: string) =>
                av.localeCompare(bv) * factor;

            switch (key) {
                case "kode":
                    return strCompare(a.kode || "", b.kode || "");
                case "nama":
                    return strCompare(a.nama || "", b.nama || "");
                case "brand":
                    return strCompare(a.brand || "", b.brand || "");
                case "lokasi":
                    return strCompare(a.lokasi || "", b.lokasi || "");
                case "stok_sisa":
                    return numCompare(a.stok_sisa ?? 0, b.stok_sisa ?? 0);
                case "satuan_nama":
                    return strCompare(
                        a.satuan_nama || "",
                        b.satuan_nama || "",
                    );
                case "harga_idr":
                    return numCompare(a.harga_idr ?? 0, b.harga_idr ?? 0);
                case "harga_total": {
                    const at =
                        (a.stok_sisa ?? 0) * (a.harga_idr ?? 0);
                    const bt =
                        (b.stok_sisa ?? 0) * (b.harga_idr ?? 0);
                    return numCompare(at, bt);
                }
                case "tanggal_masuk": {
                    const ad = a.tanggal_masuk
                        ? new Date(a.tanggal_masuk).getTime()
                        : 0;
                    const bd = b.tanggal_masuk
                        ? new Date(b.tanggal_masuk).getTime()
                        : 0;
                    return numCompare(ad, bd);
                }
                case "created_at":
                default: {
                    const ad = a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    const bd = b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;

                    // fallback ke id kalau created_at kosong
                    if (ad === 0 && bd === 0) {
                        return numCompare(a.id ?? 0, b.id ?? 0);
                    }
                    return numCompare(ad, bd);
                }
            }
        });

        return base;
    }, [stocks, search, showReturOnly, sortConfig]);

    // Pagination
    const pageCount = Math.max(
        1,
        Math.ceil(processed.length / itemsPerPage),
    );
    const safeCurrentPage = Math.min(currentPage, pageCount);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const pageItems = processed.slice(
        startIndex,
        startIndex + itemsPerPage,
    );

    function buildPageNumbers(
        current: number,
        total: number,
    ): (number | string)[] {
        const pages: (number | string)[] = [];
        if (total <= 5) {
            for (let i = 1; i <= total; i++) pages.push(i);
            return pages;
        }

        pages.push(1);

        if (current > 3) {
            pages.push("...");
        }

        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);

        for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i);
        }

        if (current < total - 2) {
            pages.push("...");
        }

        if (!pages.includes(total)) {
            pages.push(total);
        }

        return pages;
    }

    const pageNumbers = buildPageNumbers(
        safeCurrentPage,
        pageCount,
    );

    const handleGoToPage = (page: number) => {
        if (page < 1 || page > pageCount) return;
        setCurrentPage(page);
    };

    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 text-slate-800 overflow-hidden">
            {/* SIDEBAR */}
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            {/* MAIN AREA */}
            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-4 md:p-8 max-w-7xl mx-auto w-full font-inter">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-slate-200 gap-4">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                                    Inventory & Warehouse Operations
                                </h1>
                                <p className="text-slate-500 mt-1 text-base">
                                    Ringkasan stok gudang & pergerakan harian (Realtime).
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <select className="appearance-none bg-white border border-slate-300 text-slate-700 py-3 pl-4 pr-10 rounded-xl text-sm font-medium shadow-sm">
                                        <option>30 Hari Terakhir</option>
                                        <option>Bulan Ini</option>
                                        <option>Q4 2025</option>
                                    </select>
                                    <ChevronDown
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                </div>
                                <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2">
                                    <Calendar size={16} /> Laporan
                                </button>
                            </div>
                        </div>

                        {/* Charts + Movement Log */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                            <div className="lg:col-span-2">
                                <StockValueChart stocks={stocks} />
                            </div>
                            <div className="lg:col-span-1">
                                <MovementLogCard
                                    data={movements}
                                    stocks={stocks}
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-blue-500/20 gap-4">
                                <h2 className="text-2xl font-extrabold text-slate-700 flex items-center gap-3">
                                    <Package size={24} className="text-blue-500" /> Total Stok
                                    Gudang
                                </h2>

                                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
                                    <div className="flex items-center bg-slate-50 border border-slate-300 px-4 py-2 rounded-xl">
                                        <Search
                                            size={18}
                                            className="text-slate-400"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Cari SKU / Nama / Brand..."
                                            className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700"
                                            value={search}
                                            onChange={(e) =>
                                                setSearch(e.target.value)
                                            }
                                        />
                                    </div>

                                    <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600 select-none">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                                            checked={showReturOnly}
                                            onChange={(e) =>
                                                setShowReturOnly(
                                                    e.target.checked,
                                                )
                                            }
                                        />
                                        <span>
                                            Tampilkan{" "}
                                            <span className="font-semibold">
                                                Sisa Retur Barang
                                            </span>{" "}
                                            Saja
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="overflow-x-auto mt-6 rounded-xl border border-slate-200 shadow-lg">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-blue-50">
                                        <tr>
                                            {/* No. (tidak sortable) */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                No.
                                            </th>

                                            {/* Kode */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort("kode")
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Kode</span>
                                                    {renderSortIcon("kode")}
                                                </button>
                                            </th>

                                            {/* Nama Produk */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort("nama")
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Nama Produk</span>
                                                    {renderSortIcon("nama")}
                                                </button>
                                            </th>

                                            {/* Brand */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort("brand")
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Brand</span>
                                                    {renderSortIcon("brand")}
                                                </button>
                                            </th>

                                            {/* Lokasi */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort("lokasi")
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Lokasi</span>
                                                    {renderSortIcon("lokasi")}
                                                </button>
                                            </th>

                                            {/* Stok Sisa */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort("stok_sisa")
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Stok Sisa</span>
                                                    {renderSortIcon(
                                                        "stok_sisa",
                                                    )}
                                                </button>
                                            </th>

                                            {/* Satuan */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort(
                                                            "satuan_nama",
                                                        )
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Satuan</span>
                                                    {renderSortIcon(
                                                        "satuan_nama",
                                                    )}
                                                </button>
                                            </th>

                                            {/* Harga Satuan */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort("harga_idr")
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Harga Satuan</span>
                                                    {renderSortIcon(
                                                        "harga_idr",
                                                    )}
                                                </button>
                                            </th>

                                            {/* Harga Total */}
                                            <th className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSort(
                                                            "harga_total",
                                                        )
                                                    }
                                                    className="inline-flex items-center"
                                                >
                                                    <span>Harga Total</span>
                                                    {renderSortIcon(
                                                        "harga_total",
                                                    )}
                                                </button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pageItems.map((item, i) => {
                                            const hargaTotal =
                                                item.stok_sisa * item.harga_idr;
                                            const isReturStock =
                                                isReturStockFn(item);

                                            const rowClass = isReturStock
                                                ? "bg-orange-50/60 hover:bg-orange-50 border-l-4 border-orange-400"
                                                : "hover:bg-slate-50";

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={rowClass}
                                                >
                                                    <td className="px-6 py-4 text-sm text-slate-500 font-semibold">
                                                        {startIndex + i + 1}.
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                                        {item.kode}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-700 font-semibold">
                                                        <div className="flex items-center gap-2">
                                                            {isReturStock && (
                                                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                                                                    SISA RETUR
                                                                </span>
                                                            )}
                                                            <span>
                                                                {item.nama}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">
                                                        {item.brand}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">
                                                        {item.lokasi}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-bold text-emerald-700">
                                                        {item.stok_sisa}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-700">
                                                        {item.satuan_nama}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                                                        {formatIDR(
                                                            item.harga_idr,
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-extrabold text-slate-900">
                                                        {formatIDR(hargaTotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {pageItems.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="px-6 py-6 text-center text-sm text-slate-400"
                                                >
                                                    Tidak ada data stok.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {processed.length > 0 && (
                                <div className="mt-4 px-2 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <p className="text-sm text-slate-500">
                                        Menampilkan{" "}
                                        <span className="font-semibold">
                                            {startIndex + 1}
                                        </span>{" "}
                                        –{" "}
                                        <span className="font-semibold">
                                            {startIndex + pageItems.length}
                                        </span>{" "}
                                        dari{" "}
                                        <span className="font-semibold">
                                            {processed.length}
                                        </span>{" "}
                                        data
                                    </p>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() =>
                                                handleGoToPage(
                                                    safeCurrentPage - 1,
                                                )
                                            }
                                            disabled={safeCurrentPage === 1}
                                            className="px-3 py-1.5 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Prev
                                        </button>

                                        {pageNumbers.map((p, idx) =>
                                            p === "..." ? (
                                                <span
                                                    key={`ellipsis-${idx}`}
                                                    className="px-2 text-slate-400 text-sm"
                                                >
                                                    ...
                                                </span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() =>
                                                        handleGoToPage(
                                                            p as number,
                                                        )
                                                    }
                                                    className={`px-3 py-1.5 text-xs md:text-sm rounded-lg border ${p === safeCurrentPage
                                                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                                        } transition`}
                                                >
                                                    {p}
                                                </button>
                                            ),
                                        )}

                                        <button
                                            onClick={() =>
                                                handleGoToPage(
                                                    safeCurrentPage + 1,
                                                )
                                            }
                                            disabled={
                                                safeCurrentPage === pageCount
                                            }
                                            className="px-3 py-1.5 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
}
