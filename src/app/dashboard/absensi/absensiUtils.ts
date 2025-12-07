import {
  AbsensiRecord,
  CalendarDay,
  DailyStatus,
  WibParts,
} from "./absensiTypes";

// Bisa diatur via env
export const WS_URL =
  process.env.NEXT_PUBLIC_ABSENSI_WS_URL ??
  "ws://192.168.1.117:8080/ws/absensi";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://192.168.1.117:8080";

// Formatter untuk ambil bagian waktu di WIB
export const WIB_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// Formatter human readable WIB
export const WIB_HUMAN_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

// Helper: ambil bagian tanggal & waktu (WIB) dari ISO
export function getWibParts(iso: string): WibParts {
  const date = new Date(iso);
  const parts = WIB_PARTS_FORMATTER.formatToParts(date);
  const bag: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      bag[p.type] = p.value;
    }
  }
  return {
    year: parseInt(bag.year, 10),
    month: parseInt(bag.month, 10),
    day: parseInt(bag.day, 10),
    hour: parseInt(bag.hour, 10),
    minute: parseInt(bag.minute, 10),
    second: parseInt(bag.second, 10),
  };
}

// ISO → string tanggal WIB
export function formatWibDateTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `${WIB_HUMAN_FORMATTER.format(date)} WIB`;
}

// Mapping action di DB → status harian
export function mapActionToStatus(
  action: string | null | undefined
): DailyStatus {
  const a = (action ?? "").toLowerCase();
  if (a === "hadir" || a === "check_in") return "hadir";
  if (a === "izin") return "izin";
  if (a === "sakit") return "sakit";
  // default: treat unknown as hadir jika ada record
  return "hadir";
}

// Cek terlambat (>= 10:01 WIB)
export function isLateFromParts(parts: WibParts): boolean {
  const { hour, minute } = parts;
  // Window normal: 09:00–10:00 WIB
  if (hour < 9) return false;
  if (hour > 10) return true;
  if (hour === 10 && minute > 0) return true;
  return false;
}

// Build array CalendarDay untuk 1 bulan (WIB-aware)
export function buildCalendarDays(
  records: AbsensiRecord[],
  year: number,
  monthIndex: number // 0-11
): CalendarDay[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  // Map day -> record terakhir
  const map = new Map<
    number,
    { status: DailyStatus; isLate: boolean; record: AbsensiRecord }
  >();

  const sorted = [...records].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const rec of sorted) {
    const parts = getWibParts(rec.created_at);
    if (parts.year !== year || parts.month !== monthIndex + 1) continue;

    const day = parts.day;
    const status = mapActionToStatus(rec.action);
    const isLate = status === "hadir" ? isLateFromParts(parts) : false;
    map.set(day, { status, isLate, record: rec });
  }

  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = map.get(d);
    const dateObj = new Date(year, monthIndex, d);
    const isToday =
      year === todayYear && monthIndex === todayMonth && d === todayDate;

    if (entry) {
      days.push({
        date: dateObj,
        isToday,
        status: entry.status,
        isLate: entry.isLate,
        record: entry.record,
      });
    } else {
      days.push({
        date: dateObj,
        isToday,
        status: "belum_absen",
        isLate: false,
      });
    }
  }

  return days;
}

// Hitung status khusus untuk "hari ini" dari seluruh riwayat user
export function buildTodayInfo(records: AbsensiRecord[]): CalendarDay {
  const nowIso = new Date().toISOString();
  const todayParts = getWibParts(nowIso);
  const todayDate = new Date(
    todayParts.year,
    todayParts.month - 1,
    todayParts.day
  );

  if (records.length === 0) {
    return {
      date: todayDate,
      isToday: true,
      status: "belum_absen",
      isLate: false,
    };
  }

  const todays = records.filter((rec) => {
    const p = getWibParts(rec.created_at);
    return (
      p.year === todayParts.year &&
      p.month === todayParts.month &&
      p.day === todayParts.day
    );
  });

  if (todays.length === 0) {
    return {
      date: todayDate,
      isToday: true,
      status: "belum_absen",
      isLate: false,
    };
  }

  const sortedTodays = [...todays].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const last = sortedTodays[sortedTodays.length - 1];
  const lastParts = getWibParts(last.created_at);
  const status = mapActionToStatus(last.action);
  const isLate = status === "hadir" ? isLateFromParts(lastParts) : false;

  return {
    date: todayDate,
    isToday: true,
    status,
    isLate,
    record: last,
  };
}

// Label status untuk 1 hari di kalender (Alpha jika hari sudah lewat & belum absen)
export function labelForDay(day: CalendarDay): string {
  const now = new Date();
  const todayDateOnly = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const dayDateOnly = new Date(
    day.date.getFullYear(),
    day.date.getMonth(),
    day.date.getDate()
  );
  const isPast = dayDateOnly < todayDateOnly;

  if (day.status === "belum_absen") {
    if (isPast) return "Alpha (Tidak Absen)";
    return "Belum Absen";
  }
  if (day.status === "hadir") {
    return day.isLate ? "Hadir (Terlambat)" : "Hadir (Tepat Waktu)";
  }
  if (day.status === "izin") return "Izin";
  if (day.status === "sakit") return "Sakit";
  return "Belum Absen";
}

// Warna kalender per hari (accent colors)
export function colorClassForDay(day: CalendarDay): string {
  const now = new Date();
  const todayDateOnly = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const dayDateOnly = new Date(
    day.date.getFullYear(),
    day.date.getMonth(),
    day.date.getDate()
  );
  const isPast = dayDateOnly < todayDateOnly;

  if (day.status === "belum_absen") {
    if (isPast) {
      return "!border-rose-300 !bg-rose-50 !text-rose-800";
    }
    return "!border-slate-200 !bg-slate-50 !text-slate-600";
  }
  if (day.status === "hadir") {
    return day.isLate
      ? "!border-amber-300 !bg-amber-50 !text-amber-800"
      : "!border-emerald-300 !bg-emerald-50 !text-emerald-800";
  }
  if (day.status === "izin") {
    return "!border-sky-300 !bg-sky-50 !text-sky-800";
  }
  if (day.status === "sakit") {
    return "!border-rose-300 !bg-rose-50 !text-rose-800";
  }
  return "!border-slate-200 !bg-slate-50 !text-slate-600";
}
