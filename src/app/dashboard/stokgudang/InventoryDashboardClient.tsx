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
                    <span className="font-semibold">{formatIDR(item.harga_idr)}</span>
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
                    <BarChart2 size={48} className="mb-2 opacity-50 text-blue-400 z-10" />
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
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
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
                                    <div className={`w-1.5 rounded-full shrink-0 ${accentClass}`} />

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
                                                {m.sumber_tujuan ? ` • ${m.sumber_tujuan}` : ""}
                                            </span>

                                            {stokInfo ? (
                                                <span className="text-[11px] text-slate-500">
                                                    Harga:{" "}
                                                    <span className="font-semibold">
                                                        {formatIDR(hargaSatuan)}
                                                    </span>{" "}
                                                    {satuanNama && `/ ${satuanNama}`} • Nilai:{" "}
                                                    <span className="font-semibold">
                                                        {formatIDR(totalNilai)}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-slate-400">
                                                    Detail produk tidak ditemukan (stok_id: {m.stok_id})
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

function buildPageNumbers(current: number, total: number): (number | string)[] {
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

export default function InventoryDashboardClient({
    initialStocks,
    initialMovements,
}: Props) {
    const [open, setOpen] = useState(true);
    const [stocks, setStocks] = useState<StockItem[]>(initialStocks);
    const [movements, setMovements] =
        useState<Movement[]>(initialMovements);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const backendUrl =
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

    const refetchStocks = async () => {
        const res = await fetch(`${backendUrl}/api/stok`, {
            cache: "no-store",
        });
        setStocks(await res.json());
    };

    const refetchMovements = async () => {
        const res = await fetch(`${backendUrl}/api/stok/movements/recent`, {
            cache: "no-store",
        });
        setMovements(await res.json());
    };

    // Reset halaman kalau keyword berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

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

    // Filter
    const filtered = useMemo(() => {
        if (!search) return stocks;
        const q = search.toLowerCase();
        return stocks.filter(
            (s) =>
                s.kode.toLowerCase().includes(q) ||
                s.nama.toLowerCase().includes(q) ||
                s.brand.toLowerCase().includes(q) ||
                (s.lokasi || "").toLowerCase().includes(q),
        );
    }, [stocks, search]);

    // Pagination
    const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const safeCurrentPage = Math.min(currentPage, pageCount);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + itemsPerPage);
    const pageNumbers = buildPageNumbers(safeCurrentPage, pageCount);

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
                                <MovementLogCard data={movements} stocks={stocks} />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-blue-500/20 gap-4">
                                <h2 className="text-2xl font-extrabold text-slate-700 flex items-center gap-3">
                                    <Package size={24} className="text-blue-500" /> Total Stok
                                    Gudang
                                </h2>
                                <div className="flex items-center bg-slate-50 border border-slate-300 px-4 py-2 rounded-xl">
                                    <Search size={18} className="text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari SKU / Nama / Brand..."
                                        className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto mt-6 rounded-xl border border-slate-200 shadow-lg">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-blue-50">
                                        <tr>
                                            {[
                                                "No.",
                                                "Kode",
                                                "Nama Produk",
                                                "Brand",
                                                "Lokasi",
                                                "Stok Sisa",
                                                "Satuan",
                                                "Harga Satuan",
                                                "Harga Total",
                                            ].map((h) => (
                                                <th
                                                    key={h}
                                                    className="px-6 py-4 text-xs font-bold text-blue-800 uppercase tracking-wider text-left"
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pageItems.map((item, i) => {
                                            const hargaTotal = item.stok_sisa * item.harga_idr;

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4 text-sm text-slate-500 font-semibold">
                                                        {startIndex + i + 1}.
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                                        {item.kode}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-700 font-semibold">
                                                        {item.nama}
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
                                                        {formatIDR(item.harga_idr)}
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
                            {filtered.length > 0 && (
                                <div className="mt-4 px-2 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <p className="text-sm text-slate-500">
                                        Menampilkan{" "}
                                        <span className="font-semibold">{startIndex + 1}</span> –{" "}
                                        <span className="font-semibold">
                                            {startIndex + pageItems.length}
                                        </span>{" "}
                                        dari{" "}
                                        <span className="font-semibold">{filtered.length}</span>{" "}
                                        data
                                    </p>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleGoToPage(safeCurrentPage - 1)}
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
                                                    onClick={() => handleGoToPage(p as number)}
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
                                            onClick={() => handleGoToPage(safeCurrentPage + 1)}
                                            disabled={safeCurrentPage === pageCount}
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
