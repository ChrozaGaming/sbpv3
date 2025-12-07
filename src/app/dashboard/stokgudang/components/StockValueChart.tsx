import React, { useMemo } from "react";
import {
    BarChart as RechartsBarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { TrendingUp, BarChart2 } from "lucide-react";

import type { StockItem } from "../types";
import { formatIDR, formatIDRCompact } from "../utils";

interface StockValueChartProps {
    stocks: StockItem[];
}

export const StockValueChart: React.FC<StockValueChartProps> = ({ stocks }) => {
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
                        <RechartsBarChart
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
                        </RechartsBarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};
