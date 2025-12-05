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

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface StockItem {
    id: number;
    kode: string;
    nama: string;
    brand: string;        // NEW
    kategori: string;
    harga_idr: number;    // NEW
    stok_sisa: number;
    satuan_nama: string;
    lokasi: string;
}

interface Movement {
    id: number;
    stok_id: number;
    jenis: string;
    qty: number;
    satuan_id: number;
    sumber_tujuan?: string;
    keterangan?: string;
    created_at: string;
}

interface Props {
    initialStocks: StockItem[];
    initialMovements: Movement[];
}

const ChartPlaceholder = ({
    title,
    icon: Icon,
    height = "h-[450px]",
}: {
    title: string;
    icon: any;
    height?: string;
}) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl h-full">
        <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Icon size={20} className="text-blue-500" />
            {title}
        </h2>
        <div
            className={`w-full ${height} bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 relative overflow-hidden`}
        >
            <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px]" />
            <BarChart2 size={48} className="mb-2 opacity-50 text-blue-400 z-10" />
            <p className="font-medium z-10 text-sm">Visualisasi Data Stok</p>
        </div>
    </div>
);

// MovementLogCard: hanya 10 data terbaru, TANPA scroll di dalam card
const MovementLogCard = ({ data }: { data: Movement[] }) => {
    const latest10 = data.slice(0, 10); // ambil 10 terbaru saja

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex flex-col flex-1 min-h-[220px]">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-pink-500" />
                Log Pergerakan Stok (Realtime)
            </h2>
            <ul className="space-y-4">
                {latest10.map((m) => {
                    const masuk = m.jenis === "MASUK";
                    return (
                        <li
                            key={m.id}
                            className="flex items-start gap-4 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <div
                                className={`w-1.5 h-6 rounded-full shrink-0 ${masuk ? "bg-emerald-500" : "bg-red-500"
                                    } mt-1`}
                            />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-700 flex justify-between items-center">
                                    <span className="truncate">
                                        {m.keterangan || "Pergerakan"}
                                    </span>
                                    <span
                                        className={`font-extrabold text-sm shrink-0 ml-4 ${masuk ? "text-emerald-600" : "text-red-600"
                                            }`}
                                    >
                                        {masuk ? "+" : "-"}
                                        {m.qty}
                                    </span>
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 flex justify-between">
                                    <span
                                        className={`font-medium ${masuk ? "text-emerald-500" : "text-red-500"
                                            }`}
                                    >
                                        {masuk ? "Masuk Gudang" : "Keluar Gudang"}
                                    </span>
                                    <span className="text-slate-400">
                                        {new Date(m.created_at).toLocaleString("id-ID")}
                                    </span>
                                </p>
                            </div>
                        </li>
                    );
                })}
                {latest10.length === 0 && (
                    <li className="text-xs text-slate-400 text-center py-4">
                        Belum ada pergerakan stok.
                    </li>
                )}
            </ul>
        </div>
    );
};

// Helper pagination
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

// Helper format IDR
const formatIDR = (value: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

export default function InventoryDashboardClient({
    initialStocks,
    initialMovements,
}: Props) {
    const [open, setOpen] = useState(true);
    const [stocks, setStocks] = useState<StockItem[]>(initialStocks);
    const [movements, setMovements] = useState<Movement[]>(initialMovements);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const backendUrl =
        process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

    const refetchStocks = async () => {
        const res = await fetch(`${backendUrl}/api/stok`);
        setStocks(await res.json());
    };

    const refetchMovements = async () => {
        const res = await fetch(`${backendUrl}/api/stok/movements/recent`);
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

        ws.onopen = () => console.log("✅ WS connected");
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (!msg?.event) return;

                console.log("📦 WS Event:", msg.event);

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
                }
            } catch {
                // ignore plain text
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
                (s.lokasi || "").toLowerCase().includes(q)
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
                                <ChartPlaceholder
                                    title="Analisis Pergerakan Stok Bulanan"
                                    icon={TrendingUp}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <MovementLogCard data={movements} />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-blue-500/20 gap-4">
                                <h2 className="text-2xl font-extrabold text-slate-700 flex items-center gap-3">
                                    <Package size={24} className="text-blue-500" /> Total Stok Gudang
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
                                                "Harga Satuan",
                                                "Satuan",
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
                                        {pageItems.map((item, i) => (
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
                                                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                                                    {formatIDR(item.harga_idr)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-700">
                                                    {item.satuan_nama}
                                                </td>
                                            </tr>
                                        ))}
                                        {pageItems.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={8}
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
                                        <span className="font-semibold">{filtered.length}</span> data
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
                                            )
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
