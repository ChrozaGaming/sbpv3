// src/app/dashboard/stokgudang/InventoryDashboardClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import { StockValueChart } from "./components/StockValueChart";
import { MovementLogCard } from "./components/MovementLogCard";
import { InventoryTable } from "./components/InventoryTable";

import type {
    InventoryDashboardProps,
    StockItem,
    Movement,
} from "./types";

const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

const InventoryDashboardClient: React.FC<InventoryDashboardProps> = ({
    initialStocks,
    initialMovements,
}) => {
    const [open, setOpen] = useState(true);
    const [stocks, setStocks] = useState<StockItem[]>(initialStocks);
    const [movements, setMovements] =
        useState<Movement[]>(initialMovements);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const refetchStocks = async () => {
        const res = await fetch(`${backendUrl}/api/stok`, {
            cache: "no-store",
        });
        const data: StockItem[] = await res.json();
        setStocks(data);
    };

    const refetchMovements = async () => {
        const res = await fetch(`${backendUrl}/api/stok/movements/recent`, {
            cache: "no-store",
        });
        const data: Movement[] = await res.json();
        setMovements(data);
    };

    const handleDelete = async (item: StockItem) => {
        const ok = window.confirm(
            `Yakin ingin menghapus stok:\n${item.kode} — ${item.nama}?\n\nData stok ini akan dihapus dari gudang beserta riwayat pergerakannya.`,
        );
        if (!ok) return;

        try {
            setDeletingId(item.id);

            const res = await fetch(`${backendUrl}/api/stok/${item.id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error("Gagal hapus stok:", res.status, text);
                alert(
                    text ||
                    "Gagal menghapus stok. Silakan coba lagi atau cek log backend.",
                );
                return;
            }

            // stok_movements akan ikut terhapus via ON DELETE CASCADE
            setStocks((prev) => prev.filter((s) => s.id !== item.id));
        } catch (err) {
            console.error("Error delete stok:", err);
            alert("Terjadi kesalahan saat menghapus stok.");
        } finally {
            setDeletingId(null);
        }
    };

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
                        refetchStocks();
                        refetchMovements();
                        break;
                    default:
                        break;
                }
            } catch {
                // kalau pesan plain text, abaikan
            }
        };
        ws.onclose = () => console.log("❌ WS disconnected");

        return () => ws.close();
    }, []);

    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 text-slate-800 overflow-hidden">
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen} />
            </div>

            <div className="flex flex-col flex-1 min-w-0 w-full">
                <Header onToggle={() => setOpen(!open)} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-4 md:p-8 max-w-7xl mx-auto w-full font-inter">
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

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                            <div className="lg:col-span-2">
                                <StockValueChart stocks={stocks} />
                            </div>
                            <div className="lg:col-span-1">
                                <MovementLogCard data={movements} stocks={stocks} />
                            </div>
                        </div>

                        <InventoryTable
                            stocks={stocks}
                            onDelete={handleDelete}
                            deletingId={deletingId}
                        />
                    </main>

                    <Footer />
                </div>
            </div>
        </div>
    );
};

export default InventoryDashboardClient;
