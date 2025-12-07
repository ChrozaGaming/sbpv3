"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Wifi,
    WifiOff,
    Clock,
    CheckCircle2,
    AlertTriangle,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import {
    AbsensiRecord,
    AttendanceStatus,
    CalendarDay,
    ConnectionStatus,
    MonthStats,
    ServerMessage,
    ToastState,
    ToastType,
} from "./absensiTypes";
import {
    API_BASE_URL,
    WS_URL,
    buildCalendarDays,
    buildTodayInfo,
    getWibParts,
    isLateFromParts,
} from "./absensiUtils";
import AttendanceForm from "./components/AttendanceForm";
import CalendarPanel from "./components/CalendarPanel";
import LogPanel from "./components/LogPanel";

const AbsensiPage: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [statusMessage, setStatusMessage] = useState<string>(
        "Menghubungkan ke server absensi...",
    );
    const [name, setName] = useState<string>("");
    const [logs, setLogs] = useState<ServerMessage[]>([]);

    const [selectedStatus, setSelectedStatus] =
        useState<AttendanceStatus>("hadir");

    const [history, setHistory] = useState<AbsensiRecord[]>([]);
    const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    // Bulan yang sedang ditampilkan di kalender (sumber kebenaran tunggal)
    const [activeStartDate, setActiveStartDate] = useState<Date>(() => new Date());

    const [todayInfo, setTodayInfo] = useState<CalendarDay | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date | Date[] | null>(
        new Date(),
    );
    const [selectedDayInfo, setSelectedDayInfo] =
        useState<CalendarDay | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);

    // Refs untuk menghindari stale closure di WebSocket
    const nameRef = useRef<string>("");

    const toastTimeoutRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);
    const [toast, setToast] = useState<ToastState | null>(null);

    // ==== Ambil nama dari session (localStorage) dan paksa login ====
    useEffect(() => {
        if (typeof window === "undefined") return;

        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login";
            return;
        }

        const storedUser = localStorage.getItem("user");

        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser) as {
                    nama_lengkap?: string;
                };
                if (parsed.nama_lengkap) {
                    setName(parsed.nama_lengkap);
                    return;
                }
            } catch {
                // ignore parse error
            }
        }

        const nama = localStorage.getItem("nama_lengkap");
        if (nama) {
            setName(nama);
        }
    }, []);

    // Sinkronkan ref nama dengan state terbaru
    useEffect(() => {
        nameRef.current = name.trim();
    }, [name]);

    // Toast helper
    const showToast = useCallback(
        (type: ToastType, title: string, message: string) => {
            setToast({ type, title, message });
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
            toastTimeoutRef.current = setTimeout(() => {
                setToast(null);
            }, 4000);
        },
        [],
    );

    useEffect(
        () => () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
        },
        [],
    );

    // Tambah log ke atas
    const pushLog = useCallback((msg: ServerMessage) => {
        setLogs((prev) => [msg, ...prev].slice(0, 50));
    }, []);

    // Ringkasan stats untuk bulan yang sedang dilihat
    const monthStats: MonthStats = useMemo(() => {
        let hadirOnTime = 0;
        let hadirLate = 0;
        let izin = 0;
        let sakit = 0;
        let alpha = 0;

        const now = new Date();
        const todayDateOnly = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );

        for (const day of calendarDays) {
            const dayDateOnly = new Date(
                day.date.getFullYear(),
                day.date.getMonth(),
                day.date.getDate(),
            );
            const isPast = dayDateOnly < todayDateOnly;

            if (day.status === "hadir") {
                if (day.isLate) hadirLate += 1;
                else hadirOnTime += 1;
            } else if (day.status === "izin") {
                izin += 1;
            } else if (day.status === "sakit") {
                sakit += 1;
            } else if (day.status === "belum_absen" && isPast) {
                alpha += 1;
            }
        }

        return {
            hadirOnTime,
            hadirLate,
            izin,
            sakit,
            alpha,
        };
    }, [calendarDays]);

    // Ambil riwayat absensi (semua bulan) & hitung status hari ini
    const loadHistory = useCallback(
        async (nama: string) => {
            const targetName = nama.trim();
            if (!targetName) {
                setHistory([]);
                setCalendarDays([]);
                setTodayInfo(null);
                setSelectedDayInfo(null);
                setHistoryError(null);
                return;
            }

            setLoadingHistory(true);
            setHistoryError(null);

            try {
                const url = `${API_BASE_URL}/api/absensi?limit=500`;
                const res = await fetch(url, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                });

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    let msg =
                        "Gagal mengambil riwayat absensi dari server. Pastikan kamu di jaringan kantor.";
                    if (res.status === 403) {
                        msg =
                            "Akses riwayat absensi ditolak. Kemungkinan kamu tidak terhubung ke jaringan kantor (192.168.1.0/24) atau belum diizinkan.";
                        setStatus("error");
                        setStatusMessage(msg);
                    } else if (text) {
                        msg = text;
                    }

                    setHistoryError(msg);
                    setHistory([]);
                    setCalendarDays([]);
                    setTodayInfo(null);
                    setSelectedDayInfo(null);
                    return;
                }

                const data: AbsensiRecord[] = await res.json();
                const lowerTarget = targetName.toLowerCase();
                const filtered = data.filter(
                    (rec) => rec.nama.trim().toLowerCase() === lowerTarget,
                );

                setHistory(filtered);
                setTodayInfo(buildTodayInfo(filtered));
            } catch (err) {
                console.error("Error loadHistory:", err);
                const msg =
                    err instanceof Error
                        ? err.message
                        : "Terjadi kesalahan saat memuat riwayat absensi.";
                setHistoryError(msg);
                setHistory([]);
                setCalendarDays([]);
                setTodayInfo(null);
                setSelectedDayInfo(null);
            } finally {
                setLoadingHistory(false);
            }
        },
        [setStatus, setStatusMessage],
    );

    // Bangun kalender bulan aktif setiap kali riwayat atau bulan yang dilihat berubah
    useEffect(() => {
        const trimmed = name.trim();
        if (!trimmed) {
            setHistory([]);
            setCalendarDays([]);
            setTodayInfo(null);
            setSelectedDayInfo(null);
            setHistoryError(null);
            return;
        }

        if (history.length === 0) {
            setCalendarDays([]);
            setSelectedDayInfo(null);
            return;
        }

        const year = activeStartDate.getFullYear();
        const monthIndex = activeStartDate.getMonth();
        const days = buildCalendarDays(history, year, monthIndex);
        setCalendarDays(days);

        const currentSelected =
            selectedDate instanceof Date ? selectedDate : null;

        if (currentSelected) {
            const matched = days.find(
                (d) =>
                    d.date.getFullYear() === currentSelected.getFullYear() &&
                    d.date.getMonth() === currentSelected.getMonth() &&
                    d.date.getDate() === currentSelected.getDate(),
            );
            setSelectedDayInfo(matched ?? null);
        } else {
            const todayInMonth =
                days.find((d) => d.isToday) ?? days[0] ?? null;
            setSelectedDayInfo(todayInMonth);
            if (todayInMonth) {
                setSelectedDate(todayInMonth.date);
            }
        }
    }, [history, activeStartDate, name, selectedDate]);

    // Refresh riwayat ketika nama berubah (mulai dari bulan sekarang)
    useEffect(() => {
        const trimmed = name.trim();
        if (!trimmed) {
            setHistory([]);
            setCalendarDays([]);
            setTodayInfo(null);
            setSelectedDayInfo(null);
            setHistoryError(null);
            return;
        }
        setActiveStartDate(new Date());
        void loadHistory(trimmed);
    }, [name, loadHistory]);

    const connectWebSocket = useCallback(() => {
        if (typeof window === "undefined") return;

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setStatus("connecting");
        setStatusMessage("Menghubungkan ke server absensi...");

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus("connected");
                setStatusMessage("Terhubung ke server absensi (LAN kantor).");
            };

            ws.onmessage = (event) => {
                try {
                    const data: ServerMessage = JSON.parse(event.data);
                    pushLog(data);

                    if (data.status === "error") {
                        setStatusMessage(
                            data.message ||
                            "Terjadi kesalahan dari server absensi.",
                        );
                        showToast(
                            "error",
                            "Error dari server absensi",
                            data.message || "",
                        );
                    }

                    if (
                        data.status === "ok" &&
                        (data.event === "hadir" ||
                            data.event === "check_in" ||
                            data.event === "izin" ||
                            data.event === "sakit")
                    ) {
                        const currentName = nameRef.current;
                        if (currentName) {
                            void loadHistory(currentName);
                        }
                    }
                } catch (err) {
                    console.error("Gagal parse pesan dari server:", err);
                }
            };

            ws.onerror = (event) => {
                // Error koneksi awal/tidak bisa reach WS → cukup update status & pesan
                console.warn("WebSocket error:", event);
                setStatus("error");
                setStatusMessage(
                    "Gagal terhubung ke server. Pastikan kamu di jaringan Wi-Fi kantor.",
                );
                // ⬇️ Tidak ada showToast di sini lagi, supaya tidak muncul toast otomatis
            };

            ws.onclose = (event) => {
                console.warn(
                    "WebSocket closed:",
                    event.code,
                    event.reason,
                );
                if (
                    event.code === 1008 ||
                    event.code === 1003 ||
                    event.code === 1007
                ) {
                    setStatus("error");
                    setStatusMessage(
                        "Akses WebSocket ditolak. Kemungkinan kamu tidak terhubung ke jaringan kantor (192.168.1.0/24).",
                    );
                } else {
                    setStatus("disconnected");
                    setStatusMessage("Koneksi ke server absensi terputus.");
                }
            };
        } catch (err) {
            console.error("Exception saat membuat WebSocket:", err);
            setStatus("error");
            setStatusMessage(
                "Tidak dapat membuat koneksi WebSocket. Cek konfigurasi jaringan.",
            );
        }
    }, [loadHistory, pushLog, showToast]);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connectWebSocket]);

    const handleSubmitAttendance = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            showToast(
                "error",
                "Nama tidak tersedia",
                "Nama akun tidak terbaca. Silakan login ulang.",
            );
            return;
        }

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            showToast(
                "error",
                "Tidak terhubung",
                "Belum terhubung ke server absensi.",
            );
            return;
        }

        if (todayInfo && todayInfo.status !== "belum_absen") {
            showToast(
                "info",
                "Sudah absen",
                "Kamu sudah melakukan absensi untuk hari ini. Perubahan hanya bisa lewat admin.",
            );
            return;
        }

        setIsSubmitting(true);

        const payload = {
            action: selectedStatus,
            name: trimmedName,
        };

        try {
            wsRef.current.send(JSON.stringify(payload));

            const nowParts = getWibParts(new Date().toISOString());
            let statusLabel: string;
            if (selectedStatus === "hadir") {
                const late = isLateFromParts(nowParts);
                statusLabel = late
                    ? "Hadir (Terlambat)"
                    : "Hadir (Tepat Waktu)";
            } else if (selectedStatus === "izin") {
                statusLabel = "Izin";
            } else {
                statusLabel = "Sakit";
            }

            showToast(
                "success",
                "Absensi berhasil",
                `Status kamu tercatat sebagai ${statusLabel}.`,
            );

            const localMsg: ServerMessage = {
                event: "client_send",
                status: "ok",
                message: `Mengirim absensi: ${selectedStatus.toUpperCase()}`,
                name: trimmedName,
                action: selectedStatus,
                timestamp: new Date().toISOString(),
            };
            pushLog(localMsg);

            await loadHistory(trimmedName);
        } catch (err) {
            console.error("Error saat mengirim absensi:", err);
            showToast(
                "error",
                "Gagal mengirim absensi",
                "Terjadi kesalahan saat mengirim data. Coba lagi.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStatusBadge = () => {
        switch (status) {
            case "connected":
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <Wifi className="h-3.5 w-3.5" />
                        Terhubung (LAN Kantor)
                    </span>
                );
            case "connecting":
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        <Wifi className="h-3.5 w-3.5 animate-pulse" />
                        Menghubungkan...
                    </span>
                );
            case "disconnected":
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        <WifiOff className="h-3.5 w-3.5" />
                        Terputus
                    </span>
                );
            case "error":
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Error Koneksi
                    </span>
                );
        }
    };

    const alreadyAbsenToday =
        !!todayInfo &&
        todayInfo.status !== "belum_absen" &&
        !!name.trim();

    const handleCalendarChange = (value: Date | Date[] | null) => {
        setSelectedDate(value);

        const date =
            value instanceof Date
                ? value
                : Array.isArray(value) && value.length > 0
                    ? value[0]
                    : null;

        if (!date) {
            setSelectedDayInfo(null);
            return;
        }

        const matched = calendarDays.find(
            (d) =>
                d.date.getFullYear() === date.getFullYear() &&
                d.date.getMonth() === date.getMonth() &&
                d.date.getDate() === date.getDate(),
        );

        setSelectedDayInfo(matched ?? null);
    };

    const mainContent = (
        <div className="flex flex-col gap-6">
            {/* Header & Status */}
            <header className="border-b border-slate-200 pb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                        Absensi Kehadiran (Kantor)
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 max-w-xl">
                        Halaman ini hanya berfungsi dengan benar jika kamu terhubung ke
                        jaringan Wi-Fi kantor (subnet <code>192.168.1.0/24</code>).
                        Backend akan menolak IP di luar jaringan ini.
                    </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                    {renderStatusBadge()}
                    <p className="max-w-xs text-xs text-slate-500 text-left md:text-right">
                        {statusMessage}
                    </p>
                    {status !== "connected" && (
                        <button
                            type="button"
                            onClick={connectWebSocket}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Coba Koneksi Ulang
                        </button>
                    )}
                </div>
            </header>

            {/* Form + Kalender + Log */}
            <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <AttendanceForm
                    name={name}
                    todayInfo={todayInfo}
                    selectedStatus={selectedStatus}
                    onChangeStatus={setSelectedStatus}
                    statusConnection={status}
                    alreadyAbsenToday={alreadyAbsenToday}
                    isSubmitting={isSubmitting}
                    onSubmit={handleSubmitAttendance}
                />

                <div className="flex flex-col gap-6">
                    <CalendarPanel
                        name={name}
                        activeStartDate={activeStartDate}
                        onActiveStartDateChange={setActiveStartDate}
                        calendarDays={calendarDays}
                        selectedDate={selectedDate}
                        onCalendarChange={handleCalendarChange}
                        loadingHistory={loadingHistory}
                        historyError={historyError}
                        selectedDayInfo={selectedDayInfo}
                        monthStats={monthStats}
                    />

                    <LogPanel logs={logs} />
                </div>
            </section>
        </div>
    );

    const toastColor =
        toast?.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : toast?.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-sky-200 bg-sky-50 text-sky-900";

    const toastIcon =
        toast?.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : toast?.type === "error" ? (
            <AlertTriangle className="h-4 w-4 text-rose-600" />
        ) : (
            <Clock className="h-4 w-4 text-sky-600" />
        );

    return (
        <>
            {toast && (
                <div className="fixed right-4 top-20 z-50">
                    <div
                        className={`flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${toastColor}`}
                    >
                        <div className="mt-0.5">{toastIcon}</div>
                        <div className="flex-1">
                            <p className="text-xs font-semibold">{toast.title}</p>
                            <p className="mt-0.5 text-[11px] leading-snug">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setToast(null)}
                            className="ml-2 text-[11px] text-slate-500 hover:text-slate-700"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            <div className="flex h-[100dvh] w-full max-w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-800 overflow-hidden">
                <div className="shrink-0">
                    <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
                </div>

                <div className="flex flex-1 flex-col min-w-0">
                    <Header onToggle={() => setSidebarOpen((o) => !o)} />
                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        <main className="p-4 md:p-8 max-w-6xl mx-auto w-full font-inter">
                            {mainContent}
                        </main>
                        <Footer />
                    </div>
                </div>
            </div>
        </>
    );
};

export default AbsensiPage;
