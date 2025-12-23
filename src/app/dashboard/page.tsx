"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  BarChart3,
  Hammer,
  Package,
  Users,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";

export default function DashboardPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 overflow-hidden text-slate-800">

      {/* SIDEBAR */}
      <div className="shrink-0">
        <Sidebar open={open} setOpen={setOpen} />
      </div>

      {/* MAIN AREA */}
      <div className="flex flex-col flex-1 min-w-0 w-full">

        {/* HEADER */}
        <Header onToggle={() => setOpen(!open)} />

        {/* CONTENT WRAPPER (scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">

          <main className="p-5 md:p-8 max-w-7xl mx-auto w-full">

            {/* Page Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  Dashboard Overview
                </h1>
                <p className="text-slate-500 mt-1">
                  Monitoring proyek epoxy, stok material, dan aktivitas tim.
                </p>
              </div>

              <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-2">
                <Hammer size={18} />
                Buat Proyek Baru
              </button>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  title: "Proyek Aktif",
                  value: "12",
                  desc: "3 selesai bulan ini",
                  icon: <Hammer className="text-blue-600" size={24} />,
                  trend: "+2.5%",
                  color: "bg-blue-50 border-blue-200"
                },
                {
                  title: "Stok Material (Kg)",
                  value: "1,240",
                  desc: "Hardener & resin aman",
                  icon: <Package className="text-green-600" size={24} />,
                  trend: "+12%",
                  color: "bg-green-50 border-green-200"
                },
                {
                  title: "Total Tim",
                  value: "24",
                  desc: "6 orang di lapangan",
                  icon: <Users className="text-orange-600" size={24} />,
                  trend: "Stable",
                  color: "bg-orange-50 border-orange-200"
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="group bg-white border border-slate-200 rounded-xl p-6 shadow hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">
                        {item.title}
                      </p>
                      <h3 className="text-3xl font-bold mt-2">{item.value}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${item.color}`}>
                      {item.icon}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <span className={`font-semibold ${
                      item.trend === "Stable" ? "text-slate-500" : "text-green-600"
                    }`}>
                      {item.trend !== "Stable" && <ArrowUpRight size={15} className="inline-block mr-1" />}
                      {item.trend}
                    </span>
                    <span className="text-slate-400">• {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* CHART & ACTIVITY */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">

              {/* MAIN CHART */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">

                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 size={20} className="text-blue-500" />
                      Timeline Pengerjaan
                    </h2>
                    <p className="text-sm text-slate-500">Progress coating mingguan</p>
                  </div>

                  <select className="border rounded-md px-3 py-1 text-sm">
                    <option>Bulan Ini</option>
                    <option>Tahun Ini</option>
                  </select>
                </div>

                <div className="w-full h-64 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#64748b_1px,transparent_1px)] [background-size:14px_14px]"></div>
                  <TrendingUp size={48} className="text-blue-400 opacity-40 mb-3" />
                  <p className="text-slate-500 font-medium">Chart Placeholder</p>
                </div>
              </div>

              {/* ACTIVITY LOG */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">

                <h2 className="text-lg font-semibold mb-5">Aktivitas Terbaru</h2>

                <div className="space-y-6 flex-1">
                  {[
                    { text: "Material masuk: 200kg epoxy", time: "2 jam lalu", color: "bg-green-500" },
                    { text: "Proyek B2 selesai grinding", time: "5 jam lalu", color: "bg-blue-500" },
                    { text: "Invoice #INV-2024 dibuat", time: "Hari ini", color: "bg-orange-500" },
                  ].map((log, idx) => (
                    <div key={idx} className="flex gap-3 relative">
                      {idx < 2 && (
                        <div className="absolute left-[7px] top-5 bottom-[-22px] w-[2px] bg-slate-100"></div>
                      )}
                      <div className={`w-3.5 h-3.5 rounded-full mt-1.5 ${log.color} ring-4 ring-white`}></div>
                      <div>
                        <p className="font-medium">{log.text}</p>
                        <p className="text-xs text-slate-500">{log.time}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="mt-6 w-full text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition">
                  Lihat Log
                </button>

              </div>

            </div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
