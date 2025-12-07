export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type AttendanceStatus = "hadir" | "izin" | "sakit";
export type DailyStatus = "belum_absen" | "hadir" | "izin" | "sakit";

export interface ServerMessage {
  event: string;
  status: string;
  message: string;
  name?: string | null;
  action?: string | null;
  timestamp?: string | null;
  client_ip?: string | null;
}

export interface AbsensiRecord {
  id: string;
  nama: string;
  action: string;
  client_ip?: string | null;
  created_at: string; // ISO
}

export interface WibParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface CalendarDay {
  date: Date;
  isToday: boolean;
  status: DailyStatus;
  isLate: boolean;
  record?: AbsensiRecord;
}

export interface MonthStats {
  hadirOnTime: number;
  hadirLate: number;
  izin: number;
  sakit: number;
  alpha: number;
}

export type ToastType = "success" | "error" | "info";

export interface ToastState {
  type: ToastType;
  title: string;
  message: string;
}
