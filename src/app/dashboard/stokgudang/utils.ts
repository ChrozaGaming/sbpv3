// Helper format IDR
export const formatIDR = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);

// Helper format Rupiah compact (untuk axis chart)
export const formatIDRCompact = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

// Helper format datetime Waktu Indonesia Barat
export const formatDateTimeWIB = (value: string | null | undefined): string => {
  if (!value) return "-";
  try {
    const formatted = new Date(value).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `${formatted} WIB`;
  } catch {
    return value;
  }
};
