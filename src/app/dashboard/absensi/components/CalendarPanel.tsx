import React from "react";
import { Clock } from "lucide-react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

import { CalendarDay, MonthStats } from "../absensiTypes";
import {
    MONTH_NAMES,
    WIB_HUMAN_FORMATTER,
    colorClassForDay,
    labelForDay,
    formatWibDateTime,
} from "../absensiUtils";

interface CalendarPanelProps {
    name: string;
    activeStartDate: Date;
    onActiveStartDateChange: (date: Date) => void;
    calendarDays: CalendarDay[];
    selectedDate: Date | Date[] | null;
    onCalendarChange: (value: Date | Date[] | null) => void;
    loadingHistory: boolean;
    historyError: string | null;
    selectedDayInfo: CalendarDay | null;
    monthStats: MonthStats;
}

const CalendarPanel: React.FC<CalendarPanelProps> = ({
    name,
    activeStartDate,
    onActiveStartDateChange,
    calendarDays,
    selectedDate,
    onCalendarChange,
    loadingHistory,
    historyError,
    selectedDayInfo,
    monthStats,
}) => {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <div className="mb-4 space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <Clock className="h-5 w-5 text-blue-500" />
                    Kalender Absensi
                </h2>
                <p className="text-xs text-slate-500">
                    Gunakan navigasi bawaan kalender untuk pindah bulan/tahun, lalu klik
                    tanggal untuk melihat detail absensi.
                </p>
                <p className="text-[11px] text-slate-500">
                    Ringkasan untuk:{" "}
                    <span className="font-semibold">
                        {MONTH_NAMES[activeStartDate.getMonth()]}{" "}
                        {activeStartDate.getFullYear()}
                    </span>
                </p>
            </div>

            {/* Ringkasan Bulan Ini */}
            <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-emerald-700">
                        Hadir Tepat Waktu
                    </span>
                    <span className="text-lg font-bold text-emerald-800">
                        {monthStats.hadirOnTime}
                    </span>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-amber-700">
                        Hadir Terlambat
                    </span>
                    <span className="text-lg font-bold text-amber-800">
                        {monthStats.hadirLate}
                    </span>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sky-700">
                        Izin
                    </span>
                    <span className="text-lg font-bold text-sky-800">
                        {monthStats.izin}
                    </span>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-rose-700">
                        Sakit
                    </span>
                    <span className="text-lg font-bold text-rose-800">
                        {monthStats.sakit}
                    </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-slate-700">
                        Alpha (Tidak Absen)
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                        {monthStats.alpha}
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Belum Absen (hari ini / depan)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Hadir (Tepat Waktu)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Hadir (Terlambat)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-sky-700">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Izin
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-700">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Sakit
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-400 bg-rose-100 px-2 py-0.5 text-rose-800">
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    Alpha (Hari lewat & tidak absen)
                </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {name.trim() === "" ? (
                    <div className="flex items-center justify-center py-10 text-xs text-slate-400">
                        Nama tidak terbaca dari akun login.
                    </div>
                ) : calendarDays.length === 0 && !loadingHistory ? (
                    <div className="flex items-center justify-center py-10 text-xs text-slate-400">
                        Belum ada riwayat absensi untuk nama ini.
                    </div>
                ) : (
                    <Calendar
                        value={selectedDate}
                        onChange={onCalendarChange}
                        onActiveStartDateChange={({ activeStartDate }) => {
                            if (activeStartDate) {
                                onActiveStartDateChange(activeStartDate);
                            }
                        }}
                        view="month"
                        minDetail="month"
                        maxDetail="month"
                        className="w-full border-0 bg-transparent text-xs [&_.react-calendar__month-view__weekdays__weekday]:text-[10px] [&_.react-calendar__month-view__weekdays__weekday]:text-slate-500 [&_.react-calendar__month-view__weekdays__weekday]:pb-1 [&_.react-calendar__tile]:!rounded-lg [&_.react-calendar__tile]:!px-2 [&_.react-calendar__tile]:!py-1.5 [&_.react-calendar__tile]:hover:shadow-sm [&_.react-calendar__tile]:transition"
                        tileClassName={({ date, view }) => {
                            if (view !== "month") return undefined;

                            const activeYear = activeStartDate.getFullYear();
                            const activeMonth = activeStartDate.getMonth();

                            if (
                                date.getFullYear() !== activeYear ||
                                date.getMonth() !== activeMonth
                            ) {
                                return "!opacity-40";
                            }

                            const idx = date.getDate() - 1;
                            const info = calendarDays[idx];
                            if (!info) return undefined;

                            const base =
                                "!relative !rounded-lg !p-1.5 !border !transition";
                            const color = colorClassForDay(info);
                            return `${base} ${color}`;
                        }}
                        tileContent={({ date, view }) => {
                            if (view !== "month") return null;

                            const activeYear = activeStartDate.getFullYear();
                            const activeMonth = activeStartDate.getMonth();

                            if (
                                date.getFullYear() !== activeYear ||
                                date.getMonth() !== activeMonth
                            ) {
                                return null;
                            }

                            const idx = date.getDate() - 1;
                            const info = calendarDays[idx];
                            if (!info) return null;

                            return (
                                <div className="mt-1 flex flex-col gap-0.5">
                                    {info.isToday && (
                                        <span className="inline-flex max-w-[72px] items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                            Hari Ini
                                        </span>
                                    )}
                                    <span className="block text-[9px] leading-tight">
                                        {labelForDay(info)}
                                    </span>
                                </div>
                            );
                        }}
                    />
                )}
            </div>

            {loadingHistory && (
                <p className="mt-2 text-[11px] text-slate-500">
                    Memuat riwayat absensi...
                </p>
            )}
            {historyError && (
                <p className="mt-2 text-[11px] text-rose-600">{historyError}</p>
            )}

            {/* Detail Hari Terpilih */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-slate-800">
                    Detail Hari Terpilih
                </p>
                {!selectedDayInfo ? (
                    <p className="text-slate-500">
                        Pilih salah satu tanggal pada kalender untuk melihat rincian
                        absensi.
                    </p>
                ) : (
                    <>
                        <p className="text-[11px] text-slate-500">
                            Tanggal:{" "}
                            <span className="font-semibold">
                                {WIB_HUMAN_FORMATTER.format(selectedDayInfo.date)}
                            </span>
                        </p>
                        <p>
                            Status:{" "}
                            <span className="font-semibold">
                                {labelForDay(selectedDayInfo)}
                            </span>
                        </p>
                        {selectedDayInfo.record && (
                            <>
                                <p className="text-[11px] text-slate-500">
                                    Waktu absen:{" "}
                                    {formatWibDateTime(
                                        selectedDayInfo.record.created_at,
                                    )}
                                </p>
                                {selectedDayInfo.record.client_ip && (
                                    <p className="text-[11px] text-slate-500">
                                        IP:{" "}
                                        <span className="font-mono">
                                            {selectedDayInfo.record.client_ip}
                                        </span>
                                    </p>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CalendarPanel;
