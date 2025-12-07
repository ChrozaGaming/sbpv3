import React, { useMemo } from "react";
import { Clock } from "lucide-react";

import type { Movement, StockItem } from "../types";
import { formatDateTimeWIB, formatIDR } from "../utils";

interface MovementLogCardProps {
  data: Movement[];
  stocks: StockItem[];
}

export const MovementLogCard: React.FC<MovementLogCardProps> = ({
  data,
  stocks,
}) => {
  const latest10 = useMemo(
    () =>
      [...data]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
        .slice(0, 10),
    [data],
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex flex-col flex-1">
      <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Clock size={20} className="text-pink-500" />
        Log Pergerakan Stok (Realtime)
      </h2>

      <div className="mt-1 space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {latest10.map((m) => {
          const jenisUpper = m.jenis?.toUpperCase?.() ?? m.jenis;
          const masuk = jenisUpper === "MASUK";

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
              <div className="px-3 py-2 overflow-x-auto">
                <div className="flex items-stretch gap-3 min-w-max whitespace-nowrap">
                  <div className={`w-1.5 rounded-full shrink-0 ${accentClass}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
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
                          {satuanNama && `/ ${satuanNama}`} • Total:{" "}
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
