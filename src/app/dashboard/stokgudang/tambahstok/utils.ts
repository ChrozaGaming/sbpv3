export const formatRupiah = (amount: number): string => {
    return amount.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
};