import React from "react";
import { CheckCircle2 } from "lucide-react";
import {
    AttendanceStatus,
    CalendarDay,
    ConnectionStatus,
} from "../absensiTypes";
import {
    formatWibDateTime,
    labelForDay,
} from "../absensiUtils";

interface AttendanceFormProps {
    name: string;
    todayInfo: CalendarDay | null;
    selectedStatus: AttendanceStatus;
    onChangeStatus: (status: AttendanceStatus) => void;
    statusConnection: ConnectionStatus;
    alreadyAbsenToday: boolean;
    isSubmitting: boolean;
    onSubmit: () => void;
}

const AttendanceForm: React.FC<AttendanceFormProps> = ({
    name,
    todayInfo,
    selectedStatus,
    onChangeStatus,
    statusConnection,
    alreadyAbsenToday,
    isSubmitting,
    onSubmit,
}) => {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Form Absensi Harian
            </h2>

            <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="nama"
                        className="text-sm font-medium text-slate-700"
                    >
                        Nama Karyawan (otomatis dari akun){" "}
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="nama"
                        type="text"
                        value={name}
                        readOnly
                        placeholder="Nama akan terisi dari akun login"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-slate-100 cursor-not-allowed shadow-inner"
                    />
                    <p className="text-xs text-slate-400">
                        Nama diambil dari akun yang login dan tidak dapat diubah di sini.
                    </p>
                </div>

                {/* Status hari ini */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-1">
                    <p className="font-semibold">Status absensi hari ini:</p>
                    {name.trim() === "" ? (
                        <p className="text-slate-500">
                            Nama belum tersedia. Pastikan kamu sudah login ulang jika
                            masalah berlanjut.
                        </p>
                    ) : todayInfo ? (
                        <>
                            <p>
                                <span className="font-semibold">
                                    {labelForDay(todayInfo)}
                                </span>
                            </p>
                            {todayInfo.record && (
                                <p className="text-[11px] text-slate-500">
                                    Terakhir absen pada{" "}
                                    {formatWibDateTime(todayInfo.record.created_at)}.
                                </p>
                            )}
                        </>
                    ) : (
                        <p>Belum ada data untuk hari ini.</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1">
                        Batas absensi normal:{" "}
                        <span className="font-semibold">09.00–10.00 WIB</span>. Di atas
                        itu akan tercatat sebagai{" "}
                        <span className="font-semibold">Hadir (Terlambat)</span>.
                    </p>
                </div>

                {/* Pilih status */}
                <div className="flex flex-col gap-2 mt-2">
                    <span className="text-sm font-medium text-slate-700">
                        Status Kehadiran Hari Ini{" "}
                        <span className="text-red-500">*</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {(
                            [
                                ["hadir", "Hadir"],
                                ["izin", "Izin"],
                                ["sakit", "Sakit"],
                            ] as [AttendanceStatus, string][]
                        ).map(([value, label]) => {
                            const active = selectedStatus === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => onChangeStatus(value)}
                                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${active
                                        ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                        }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-400">
                        Pilih salah satu status kehadiran untuk hari ini.
                    </p>
                </div>

                {/* Tombol submit */}
                <div className="mt-4 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={
                            statusConnection !== "connected" ||
                            !name.trim() ||
                            alreadyAbsenToday ||
                            isSubmitting
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-emerald-700 hover:to-emerald-800 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500 disabled:shadow-none"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {alreadyAbsenToday
                            ? "Sudah Absen Hari Ini"
                            : isSubmitting
                                ? "Mengirim..."
                                : "Kirim Absensi Hari Ini"}
                    </button>
                    <p className="text-[11px] text-slate-400">
                        Jika tombol tidak aktif, berarti belum terhubung ke server, nama
                        tidak terbaca dari akun, kamu sedang mengirim absensi, atau kamu
                        sudah absen hari ini.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AttendanceForm;
