"use client";

import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { NotificationState } from "./productTypes";

interface NotificationToastProps {
    notification: NotificationState;
    onClose: () => void;
}

export const NotificationToast = ({
    notification,
    onClose,
}: NotificationToastProps) => {
    const { message, type } = notification;
    const isSuccess = type === "success";

    return (
        <div
            className={`relative p-4 pr-10 rounded-xl shadow-xl flex items-start space-x-3 transition-all duration-300 ease-in-out transform mb-3
      ${isSuccess
                    ? "bg-emerald-50 border border-emerald-300"
                    : "bg-red-50 border border-red-300"
                } pointer-events-auto`}
            role="alert"
        >
            <div className={`mt-0.5 ${isSuccess ? "text-emerald-600" : "text-red-600"}`}>
                {isSuccess ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div className="flex-1">
                <p
                    className={`text-sm font-semibold ${isSuccess ? "text-emerald-800" : "text-red-800"
                        }`}
                >
                    {isSuccess ? "Berhasil" : "Gagal"}
                </p>
                <p
                    className={`text-xs ${isSuccess ? "text-emerald-700" : "text-red-700"
                        }`}
                >
                    {message}
                </p>
            </div>
            <button
                onClick={onClose}
                className={`absolute top-2 right-2 p-1 rounded-full ${isSuccess
                    ? "text-emerald-500 hover:bg-emerald-100"
                    : "text-red-500 hover:bg-red-100"
                    } transition`}
                aria-label="Tutup notifikasi"
            >
                <X size={16} />
            </button>
        </div>
    );
};

interface NotificationContainerProps {
    notifications: NotificationState[];
    removeNotification: (id: number) => void;
}

export const NotificationContainer = ({
    notifications,
    removeNotification,
}: NotificationContainerProps) => (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm pointer-events-none">
        {notifications.map((n) => (
            <NotificationToast
                key={n.id}
                notification={n}
                onClose={() => removeNotification(n.id)}
            />
        ))}
    </div>
);
