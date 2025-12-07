import React from "react";
import { Clock } from "lucide-react";
import { ServerMessage } from "../absensiTypes";
import { formatWibDateTime } from "../absensiUtils";

interface LogPanelProps {
    logs: ServerMessage[];
}

const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm flex flex-col">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Clock className="h-5 w-5 text-blue-500" />
                Log Aktivitas Realtime
            </h2>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs max-h-72">
                {logs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-400">
                        Belum ada aktivitas.
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {logs.map((log, idx) => (
                            <li
                                key={idx}
                                className="rounded-lg bg-white px-3 py-2 shadow-sm border border-slate-200"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-mono text-slate-400">
                                        {log.timestamp ? formatWibDateTime(log.timestamp) : ""}
                                    </span>
                                    <span
                                        className={`text-[10px] uppercase font-semibold ${log.status === "ok"
                                            ? "text-emerald-600"
                                            : "text-rose-600"
                                            }`}
                                    >
                                        {log.event}
                                    </span>
                                </div>
                                <p className="mt-1 text-slate-700 text-[11px]">
                                    {log.message}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                                    {log.name && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                            Nama:{" "}
                                            <span className="font-semibold">{log.name}</span>
                                        </span>
                                    )}
                                    {log.action && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                            Aksi:{" "}
                                            <span className="font-semibold">{log.action}</span>
                                        </span>
                                    )}
                                    {log.client_ip && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                            IP:{" "}
                                            <span className="font-mono">
                                                {log.client_ip}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <p className="mt-2 text-[10px] text-slate-400">
                Log ini menampilkan pesan realtime dari WebSocket. Data absensi utama
                tetap bersumber dari database backend.
            </p>
        </div>
    );
};

export default LogPanel;
