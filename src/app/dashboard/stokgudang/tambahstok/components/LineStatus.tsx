import React from "react";
import { Search, AlertTriangle, CheckCircle } from "lucide-react";
import type { StockLine } from "../types";

interface LineStatusProps {
    line: StockLine;
}

export const LineStatus: React.FC<LineStatusProps> = ({ line }) => {
    if (line.isFetching) {
        return (
            <span className="mt-1 flex items-center gap-1 text-xs text-indigo-500">
                <Search className="h-3 w-3 animate-pulse" /> Mencari...
            </span>
        );
    }

    if (line.error) {
        return (
            <p className="mt-1 flex items-start gap-1 text-[10px] text-red-600">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {line.error}
            </p>
        );
    }

    if (line.product) {
        return (
            <p className="mt-1 flex items-start gap-1 text-[10px] text-teal-600">
                <CheckCircle className="h-3 w-3 flex-shrink-0" />
                Produk terdeteksi
            </p>
        );
    }

    return null;
};
