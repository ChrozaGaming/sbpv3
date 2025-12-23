"use client";

import React, {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import Swal from "sweetalert2";
import {
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    FileText,
    GraduationCap,
    Landmark,
    MapPin,
    Phone,
    Save,
    ShieldCheck,
    User2,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/* ===========================
   Types
   =========================== */

type StatusAktif = "aktif" | "nonaktif";
type JenisKelamin = "L" | "P";
type StatusPerkawinan = "Belum Kawin" | "Kawin" | "Cerai";
type Pendidikan =
    | "SD"
    | "SMP"
    | "SMA/SMK"
    | "D1"
    | "D2"
    | "D3"
    | "D4"
    | "S1"
    | "S2"
    | "S3"
    | "Lainnya";

type FormPegawai = {
    pegawai_id?: string;

    nik: string;
    no_kk: string;
    nama_lengkap: string;
    nama_panggilan: string;
    jenis_kelamin: JenisKelamin;
    tempat_lahir: string;
    tanggal_lahir: string;
    agama: string;

    status_perkawinan: StatusPerkawinan;
    pendidikan_terakhir: Pendidikan;

    no_hp: string;
    email: string;

    alamat_ktp: string;
    kelurahan_ktp: string;
    kecamatan_ktp: string;
    kota_kab_ktp: string;
    provinsi_ktp: string;
    kode_pos_ktp: string;

    alamat_domisili: string;
    kelurahan_domisili: string;
    kecamatan_domisili: string;
    kota_kab_domisili: string;
    provinsi_domisili: string;
    kode_pos_domisili: string;

    kontak_darurat_nama: string;
    kontak_darurat_hubungan: string;
    kontak_darurat_no_hp: string;

    npwp: string;
    bpjs_kesehatan: string;
    bpjs_ketenagakerjaan: string;

    bank_nama: string;
    bank_no_rekening: string;
    bank_nama_pemilik: string;

    foto_url: string;
    status_aktif: StatusAktif;
    tanggal_masuk: string;
    catatan: string;
};

/* ===========================
   BANK GROUPS
   =========================== */

const BANK_GROUPS: Array<{
    label: string;
    options: Array<{ value: string; label: string }>;
}> = [
    {
        label: "Bank Umum (Indonesia)",
        options: [
            {value: "Bank Aceh Syariah", label: "Bank Aceh Syariah (116)"},
            {value: "Bank Aladin Syariah", label: "Bank Aladin Syariah (947)"},
            {value: "Bank Allo Indonesia", label: "Bank Allo Indonesia (567)"},
            {value: "Bank Amar Indonesia", label: "Bank Amar Indonesia (531)"},
            {value: "Bank ANZ Indonesia", label: "Bank ANZ Indonesia (061)"},
            {value: "Bank Artha Graha Internasional", label: "Bank Artha Graha Internasional (037)"},
            {value: "Bank Banten", label: "Bank Banten (137)"},
            {value: "Bank BCA Syariah", label: "Bank BCA Syariah (536)"},
            {value: "Bank Bengkulu", label: "Bank Bengkulu (133)"},
            {value: "Bank BJB", label: "Bank BJB (110)"},
            {value: "Bank BJB Syariah", label: "Bank BJB Syariah (425)"},
            {value: "Bank BNP Paribas Indonesia", label: "Bank BNP Paribas Indonesia (057)"},
            {value: "Bank BPD Bali", label: "Bank BPD Bali (129)"},
            {value: "Bank BPD DIY", label: "Bank BPD DIY (112)"},
            {value: "Bank BRK Syariah", label: "Bank BRK Syariah (119)"},
            {value: "Bank BSG", label: "Bank BSG (127)"},
            {value: "Bank BTPN Syariah", label: "Bank BTPN Syariah (547)"},
            {value: "Bank Bumi Arta", label: "Bank Bumi Arta (076)"},
            {value: "Bank Capital Indonesia", label: "Bank Capital Indonesia (054)"},
            {value: "Bank Central Asia", label: "Bank Central Asia / BCA (014)"},
            {value: "Bank China Construction Bank Indonesia", label: "Bank China Construction Bank Indonesia (036)"},
            {value: "Bank CIMB Niaga", label: "Bank CIMB Niaga (022)"},
            {value: "Bank CTBC Indonesia", label: "Bank CTBC Indonesia (949)"},
            {value: "Bank Danamon Indonesia", label: "Bank Danamon Indonesia (011)"},
            {value: "Bank DBS Indonesia", label: "Bank DBS Indonesia (046)"},
            {value: "Bank Digital BCA", label: "Bank Digital BCA (501)"},
            {value: "Bank Ganesha", label: "Bank Ganesha (161)"},
            {value: "Bank Hana Indonesia", label: "Bank Hana Indonesia (484)"},
            {value: "Bank Hibank Indonesia", label: "Bank Hibank Indonesia (553)"},
            {value: "Bank HSBC Indonesia", label: "Bank HSBC Indonesia (087)"},
            {value: "Bank IBK Indonesia", label: "Bank IBK Indonesia (945)"},
            {value: "Bank ICBC Indonesia", label: "Bank ICBC Indonesia (164)"},
            {value: "Bank Ina Perdana", label: "Bank Ina Perdana (513)"},
            {value: "Bank Index Selindo", label: "Bank Index Selindo (555)"},
            {value: "Bank Jago", label: "Bank Jago (542)"},
            {value: "Bank Jakarta", label: "Bank Jakarta (111)"},
            {value: "Bank Jambi", label: "Bank Jambi (115)"},
            {value: "Bank Jateng", label: "Bank Jateng (113)"},
            {value: "Bank Jatim", label: "Bank Jatim (114)"},
            {value: "Bank J Trust Indonesia", label: "Bank J Trust Indonesia (095)"},
            {value: "Bank Kalbar", label: "Bank Kalbar (123)"},
            {value: "Bank Kalsel", label: "Bank Kalsel (122)"},
            {value: "Bank Kalteng", label: "Bank Kalteng (125)"},
            {value: "Bank Kaltimtara", label: "Bank Kaltimtara (124)"},
            {value: "Bank KB Indonesia", label: "Bank KB Indonesia (441)"},
            {value: "Bank KB Syariah", label: "Bank KB Syariah (521)"},
            {value: "Bank Krom Indonesia", label: "Bank Krom Indonesia (459)"},
            {value: "Bank Lampung", label: "Bank Lampung (121)"},
            {value: "Bank Maluku Malut", label: "Bank Maluku Malut (131)"},
            {value: "Bank Mandiri", label: "Bank Mandiri (008)"},
            {value: "Bank Mandiri Taspen", label: "Bank Mandiri Taspen (564)"},
            {value: "Bank Maspion", label: "Bank Maspion (157)"},
            {value: "Bank Mayapada Internasional", label: "Bank Mayapada Internasional (097)"},
            {value: "Bank Maybank Indonesia", label: "Bank Maybank Indonesia (016)"},
            {value: "Bank Mega", label: "Bank Mega (426)"},
            {value: "Bank Mega Syariah", label: "Bank Mega Syariah (506)"},
            {value: "Bank Mestika Dharma", label: "Bank Mestika Dharma (151)"},
            {value: "Bank Mizuho Indonesia", label: "Bank Mizuho Indonesia (048)"},
            {value: "Bank MNC Internasional", label: "Bank MNC Internasional (485)"},
            {value: "Bank Muamalat Indonesia", label: "Bank Muamalat Indonesia (147)"},
            {value: "Bank Multiarta Sentosa", label: "Bank Multiarta Sentosa (548)"},
            {value: "Bank Nagari", label: "Bank Nagari (118)"},
            {value: "Bank Nano Syariah", label: "Bank Nano Syariah (253)"},
            {value: "Bank Nationalnobu", label: "Bank Nationalnobu (503)"},
            {value: "Bank Negara Indonesia", label: "Bank Negara Indonesia / BNI (009)"},
            {value: "Bank Neo Commerce", label: "Bank Neo Commerce (490)"},
            {value: "Bank NTB Syariah", label: "Bank NTB Syariah (128)"},
            {value: "Bank NTT", label: "Bank NTT (130)"},
            {value: "Bank OCBC Indonesia", label: "Bank OCBC Indonesia (028)"},
            {value: "Bank of India Indonesia", label: "Bank of India Indonesia (146)"},
            {value: "Bank Oke Indonesia", label: "Bank Oke Indonesia (526)"},
            {value: "Bank Panin", label: "Bank Panin (019)"},
            {value: "Bank Panin Dubai Syariah", label: "Bank Panin Dubai Syariah (517)"},
            {value: "Bank Papua", label: "Bank Papua (132)"},
            {value: "Bank Permata", label: "Bank Permata (013)"},
            {value: "Bank QNB Indonesia", label: "Bank QNB Indonesia (167)"},
            {value: "Bank Rakyat Indonesia", label: "Bank Rakyat Indonesia / BRI (002)"},
            {value: "Bank Raya Indonesia", label: "Bank Raya Indonesia (494)"},
            {value: "Bank Resona Perdania", label: "Bank Resona Perdania (047)"},
            {value: "Bank Sahabat Sampoerna", label: "Bank Sahabat Sampoerna (523)"},
            {value: "Bank Saqu Indonesia", label: "Bank Saqu Indonesia (472)"},
            {value: "Bank SBI Indonesia", label: "Bank SBI Indonesia (498)"},
            {value: "Bank Seabank Indonesia", label: "Bank Seabank Indonesia (535)"},
            {value: "Bank Shinhan Indonesia", label: "Bank Shinhan Indonesia (152)"},
            {value: "Bank Sinarmas", label: "Bank Sinarmas (153)"},
            {value: "Bank SMBC Indonesia", label: "Bank SMBC Indonesia (213)"},
            {value: "Bank Sulselbar", label: "Bank Sulselbar (126)"},
            {value: "Bank Sulteng", label: "Bank Sulteng (134)"},
            {value: "Bank Sultra", label: "Bank Sultra (135)"},
            {value: "Bank Sumsel Babel", label: "Bank Sumsel Babel (120)"},
            {value: "Bank Sumut", label: "Bank Sumut (117)"},
            {value: "Bank Superbank Indonesia", label: "Bank Superbank Indonesia (562)"},
            {value: "Bank Syariah Indonesia", label: "Bank Syariah Indonesia / BSI (451)"},
            {value: "Bank Syariah Nasional", label: "Bank Syariah Nasional (405)"},
            {value: "Bank Tabungan Negara", label: "Bank Tabungan Negara / BTN (200)"},
            {value: "Bank UOB Indonesia", label: "Bank UOB Indonesia (023)"},
            {value: "Bank Victoria Internasional", label: "Bank Victoria Internasional (566)"},
            {value: "Bank Woori Saudara", label: "Bank Woori Saudara (212)"},
        ],
    },
    {
        label: "Kantor Cabang Bank Asing (di Indonesia)",
        options: [
            {value: "Bank of America", label: "Bank of America (033)"},
            {value: "Bank of China", label: "Bank of China (069)"},
            {value: "Citibank", label: "Citibank (031)"},
            {value: "Deutsche Bank", label: "Deutsche Bank (067)"},
            {value: "JPMorgan Chase Bank", label: "JPMorgan Chase Bank (032)"},
            {value: "MUFG Bank", label: "MUFG Bank (042)"},
            {value: "Standard Chartered Bank", label: "Standard Chartered Bank (050)"},
        ],
    },
    {
        label: "Unit Usaha Syariah (UUS)",
        options: [
            {value: "Bank BTN Syariah", label: "Bank BTN Syariah (UUS)"},
            {value: "Bank BPD DIY Syariah", label: "Bank BPD DIY Syariah (UUS)"},
            {value: "Bank Jakarta Syariah", label: "Bank Jakarta Syariah (UUS)"},
            {value: "Bank Jambi Syariah", label: "Bank Jambi Syariah (UUS)"},
            {value: "Bank Jateng Syariah", label: "Bank Jateng Syariah (UUS)"},
            {value: "Bank Jatim Syariah", label: "Bank Jatim Syariah (UUS)"},
            {value: "Bank Kalbar Syariah", label: "Bank Kalbar Syariah (UUS)"},
            {value: "Bank Kalsel Syariah", label: "Bank Kalsel Syariah (UUS)"},
            {value: "Bank Kaltimtara Syariah", label: "Bank Kaltimtara Syariah (UUS)"},
            {value: "Bank Nagari Syariah", label: "Bank Nagari Syariah (UUS)"},
            {value: "Bank Sulselbar Syariah", label: "Bank Sulselbar Syariah (UUS)"},
            {value: "Bank Sumsel Babel Syariah", label: "Bank Sumsel Babel Syariah (UUS)"},
            {value: "Bank Sumut Syariah", label: "Bank Sumut Syariah (UUS)"},
            {value: "Bank CIMB Niaga Syariah", label: "Bank CIMB Niaga Syariah (UUS)"},
            {value: "Bank Danamon Syariah", label: "Bank Danamon Syariah (UUS)"},
            {value: "Bank Jago Syariah", label: "Bank Jago Syariah (UUS)"},
            {value: "Bank Maybank Syariah Indonesia", label: "Bank Maybank Syariah Indonesia (UUS)"},
            {value: "Bank OCBC Syariah Indonesia", label: "Bank OCBC Syariah Indonesia (UUS)"},
            {value: "Bank Permata Syariah", label: "Bank Permata Syariah (UUS)"},
        ],
    },
];

/* ===========================
   Initial State
   =========================== */

const initialForm: FormPegawai = {
    nik: "",
    no_kk: "",
    nama_lengkap: "",
    nama_panggilan: "",
    jenis_kelamin: "L",
    tempat_lahir: "",
    tanggal_lahir: "",
    agama: "",

    status_perkawinan: "Belum Kawin",
    pendidikan_terakhir: "SMA/SMK",

    no_hp: "",
    email: "",

    alamat_ktp: "",
    kelurahan_ktp: "",
    kecamatan_ktp: "",
    kota_kab_ktp: "",
    provinsi_ktp: "",
    kode_pos_ktp: "",

    alamat_domisili: "",
    kelurahan_domisili: "",
    kecamatan_domisili: "",
    kota_kab_domisili: "",
    provinsi_domisili: "",
    kode_pos_domisili: "",

    kontak_darurat_nama: "",
    kontak_darurat_hubungan: "",
    kontak_darurat_no_hp: "",

    npwp: "",
    bpjs_kesehatan: "",
    bpjs_ketenagakerjaan: "",

    bank_nama: "",
    bank_no_rekening: "",
    bank_nama_pemilik: "",

    foto_url: "",
    status_aktif: "aktif",
    tanggal_masuk: "",
    catatan: "",
};

/* ===========================
   Utils
   =========================== */

function onlyDigits(v: string) {
    return v.replace(/\D+/g, "");
}

function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

const ENV_API_BASE =
    (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

function inferApiBase() {
    if (ENV_API_BASE) return ENV_API_BASE;
    if (typeof window === "undefined") return "http://localhost:8080";
    const proto = window.location.protocol; // http: / https:
    const host = window.location.hostname;
    return `${proto}//${host}:8080`;
}

function getAuthHeaders() {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
    return token ? {Authorization: `Bearer ${token}`} : {};
}

function toApiPayload(form: FormPegawai) {
    const obj: any = {};
    for (const [k, v] of Object.entries(form)) {
        if (typeof v === "string") {
            const t = v.trim();
            obj[k] = t === "" ? null : t;
        } else {
            obj[k] = v ?? null;
        }
    }
    return obj;
}

function fromApiToForm(data: any): FormPegawai {
    const out: any = {...initialForm};

    for (const key of Object.keys(out)) {
        const v = data?.[key];
        if (v === null || v === undefined) continue; // keep default (string kosong / default enum)
        out[key] = String(v);
    }

    if (data?.pegawai_id) out.pegawai_id = String(data.pegawai_id);
    return out as FormPegawai;
}

async function safeJson(res: Response) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

// SweetAlert helper (toast)
const toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 1600,
    timerProgressBar: true,
});

/* ===========================
   Page
   =========================== */

export default function Page() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // edit mode kalau ada ?id=...
    const id = searchParams.get("id");
    const isEdit = Boolean(id);

    const apiBase = useMemo(() => inferApiBase(), []);

    const [open, setOpen] = useState(true);

    const [form, setForm] = useState<FormPegawai>(initialForm);
    const [sameAsKtp, setSameAsKtp] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [apiError, setApiError] = useState<string | null>(null);

    // Copy KTP -> Domisili kalau checkbox aktif
    useEffect(() => {
        if (!sameAsKtp) return;
        setForm((prev) => ({
            ...prev,
            alamat_domisili: prev.alamat_ktp,
            kelurahan_domisili: prev.kelurahan_ktp,
            kecamatan_domisili: prev.kecamatan_ktp,
            kota_kab_domisili: prev.kota_kab_ktp,
            provinsi_domisili: prev.provinsi_ktp,
            kode_pos_domisili: prev.kode_pos_ktp,
        }));
    }, [
        sameAsKtp,
        form.alamat_ktp,
        form.kelurahan_ktp,
        form.kecamatan_ktp,
        form.kota_kab_ktp,
        form.provinsi_ktp,
        form.kode_pos_ktp,
    ]);

    // Load data saat edit (FIX: AbortError aman + guard active)
    useEffect(() => {
        if (!isEdit || !id) return;

        const controller = new AbortController();
        let active = true;

        const run = async () => {
            setLoading(true);
            setApiError(null);

            try {
                const res = await fetch(`${apiBase}/api/masterpegawai/${encodeURIComponent(id)}`, {
                    method: "GET",
                    headers: {...getAuthHeaders()},
                    signal: controller.signal,
                });

                const json = await safeJson(res);

                if (!active) return;

                if (!res.ok) {
                    throw new Error(json?.message || `Gagal memuat data (HTTP ${res.status})`);
                }

                const data = json?.data ?? json;
                setForm(fromApiToForm(data));
            } catch (e: any) {
                // ✅ penting: abort jangan dianggap error runtime
                if (!active) return;
                if (controller.signal.aborted || e?.name === "AbortError") return;

                const msg = e?.message || "Gagal memuat data pegawai";
                setApiError(msg);

                await Swal.fire({
                    icon: "error",
                    title: "Gagal memuat",
                    text: msg,
                });
            } finally {
                if (active) setLoading(false);
            }
        };

        // ✅ extra guard untuk mencegah unhandled rejection overlay
        run().catch((e) => {
            if (!controller.signal.aborted && e?.name !== "AbortError") {
                // optional log
                // console.error(e);
            }
        });

        return () => {
            active = false;
            if (!controller.signal.aborted) {
                try {
                    controller.abort("cleanup");
                } catch {
                    // ignore
                }
            }
        };
    }, [isEdit, id, apiBase]);

    const requiredErrors = useMemo(() => {
        const errs: Record<string, string> = {};
        if (!form.nik.trim() || form.nik.trim().length !== 16) errs.nik = "NIK wajib 16 digit.";
        if (!form.nama_lengkap.trim()) errs.nama_lengkap = "Nama lengkap wajib diisi.";
        if (!form.no_hp.trim()) errs.no_hp = "No HP wajib diisi.";
        if (!form.alamat_ktp.trim()) errs.alamat_ktp = "Alamat KTP wajib diisi.";
        if (!form.kota_kab_ktp.trim()) errs.kota_kab_ktp = "Kota/Kab KTP wajib diisi.";
        if (!form.provinsi_ktp.trim()) errs.provinsi_ktp = "Provinsi KTP wajib diisi.";
        if (!form.bank_nama.trim()) errs.bank_nama = "Bank wajib dipilih.";
        if (!form.bank_no_rekening.trim()) errs.bank_no_rekening = "No rekening wajib diisi.";
        if (!form.bank_nama_pemilik.trim()) errs.bank_nama_pemilik = "Nama pemilik rekening wajib diisi.";
        return errs;
    }, [form]);

    const canSubmit = useMemo(
        () => Object.keys(requiredErrors).length === 0 && !saving && !loading,
        [requiredErrors, saving, loading]
    );

    function update<K extends keyof FormPegawai>(key: K, value: FormPegawai[K]) {
        setSaved(false);
        setApiError(null);
        setForm((prev) => ({...prev, [key]: value}));
    }

    function handleSameAsKtpToggle(next: boolean) {
        setSameAsKtp(next);
        setSaved(false);
        setApiError(null);

        if (next) {
            setForm((prev) => ({
                ...prev,
                alamat_domisili: prev.alamat_ktp,
                kelurahan_domisili: prev.kelurahan_ktp,
                kecamatan_domisili: prev.kecamatan_ktp,
                kota_kab_domisili: prev.kota_kab_ktp,
                provinsi_domisili: prev.provinsi_ktp,
                kode_pos_domisili: prev.kode_pos_ktp,
            }));
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaved(false);
        setApiError(null);

        if (!canSubmit) {
            await toast.fire({
                icon: "warning",
                title: "Lengkapi field wajib dulu",
            });

            const firstKey = Object.keys(requiredErrors)[0];
            const el = document.querySelector(`[name="${firstKey}"]`) as HTMLElement | null;
            el?.scrollIntoView({behavior: "smooth", block: "center"});
            (el as HTMLInputElement | null)?.focus?.();
            return;
        }

        setSaving(true);
        try {
            const payload = toApiPayload(form);

            const url = isEdit
                ? `${apiBase}/api/masterpegawai/${encodeURIComponent(id as string)}`
                : `${apiBase}/api/masterpegawai`;

            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders(),
                },
                body: JSON.stringify(payload),
            });

            const json = await safeJson(res);

            if (!res.ok) {
                throw new Error(json?.message || `Gagal menyimpan (HTTP ${res.status})`);
            }
            if (json && json.success === false) {
                throw new Error(json.message || "Gagal menyimpan");
            }

            setSaved(true);

            // sync form kalau backend balikin data terbaru
            const data = json?.data;
            if (data) setForm(fromApiToForm(data));

            await toast.fire({
                icon: "success",
                title: isEdit ? "Berhasil update pegawai" : "Berhasil simpan pegawai",
            });

            await new Promise((r) => setTimeout(r, 300));

            router.push("/dashboard/pegawai");
            router.refresh();
        } catch (err: any) {
            const msg = err?.message || "Terjadi kesalahan saat menyimpan.";
            setApiError(msg);

            await Swal.fire({
                icon: "error",
                title: "Gagal menyimpan",
                text: msg,
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex h-[100dvh] w-full max-w-full bg-slate-100 overflow-hidden text-slate-800">
            {/* SIDEBAR */}
            <div className="shrink-0">
                <Sidebar open={open} setOpen={setOpen}/>
            </div>

            {/* MAIN AREA */}
            <div className="flex flex-col flex-1 min-w-0 w-full">
                {/* HEADER */}
                <Header onToggle={() => setOpen(!open)}/>

                {/* CONTENT WRAPPER */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <main className="p-5 md:p-8 max-w-6xl mx-auto w-full">
                        {/* Page Header */}
                        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-4">
                                    <div
                                        className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
                                        <User2 className="h-6 w-6"/>
                                    </div>

                                    <div>
                                        <h1 className="text-xl font-bold text-slate-900">
                                            {isEdit ? "Edit Pegawai Lapangan" : "Form Pegawai Lapangan"}
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {isEdit
                                                ? "Perbarui master data pegawai kontraktor/field worker."
                                                : "Input master data pegawai kontraktor/field worker."}
                                        </p>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <Link
                                                href="/dashboard/pegawai"
                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                            >
                                                <ArrowLeft className="h-4 w-4"/>
                                                Kembali
                                            </Link>

                                            {loading && (
                                                <span
                                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                          Memuat...
                        </span>
                                            )}

                                            {saved && (
                                                <span
                                                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4"/>
                          Tersimpan
                        </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:items-end">
                                    <button
                                        type="submit"
                                        form="form-pegawai"
                                        disabled={!canSubmit}
                                        className={cn(
                                            "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition",
                                            canSubmit ? "bg-slate-900 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-500"
                                        )}
                                    >
                                        <Save className="h-4 w-4"/>
                                        {saving ? "Menyimpan..." : isEdit ? "Update" : "Simpan"}
                                    </button>

                                    <p className="text-xs text-slate-500">
                                        Field bertanda <span className="font-bold text-rose-600">*</span> wajib diisi.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* API Error banner (optional) */}
                        {apiError && (
                            <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <ClipboardList className="mt-0.5 h-5 w-5 text-rose-700"/>
                                    <div>
                                        <p className="font-semibold text-rose-900">Terjadi error</p>
                                        <p className="text-sm text-rose-800">{apiError}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Warning required */}
                        {Object.keys(requiredErrors).length > 0 && (
                            <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <ClipboardList className="mt-0.5 h-5 w-5 text-amber-700"/>
                                    <div>
                                        <p className="font-semibold text-amber-900">Ada data wajib yang belum
                                            lengkap</p>
                                        <p className="text-sm text-amber-800">
                                            Lengkapi field wajib (NIK, nama, no HP, alamat KTP, kota/provinsi KTP, dan
                                            data bank).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <form id="form-pegawai" onSubmit={onSubmit} className="space-y-6">
                            <Section icon={<User2 className="h-5 w-5"/>} title="Identitas Pegawai"
                                     subtitle="Data dasar untuk administrasi lapangan.">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                    <Field className="md:col-span-4" label="NIK (16 digit)" required
                                           error={requiredErrors.nik}>
                                        <Input
                                            name="nik"
                                            value={form.nik}
                                            inputMode="numeric"
                                            maxLength={16}
                                            onChange={(e) => update("nik", onlyDigits(e.target.value))}
                                            placeholder="16 digit"
                                            invalid={!!requiredErrors.nik}
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="No. KK (opsional)">
                                        <Input
                                            name="no_kk"
                                            value={form.no_kk}
                                            inputMode="numeric"
                                            maxLength={16}
                                            onChange={(e) => update("no_kk", onlyDigits(e.target.value))}
                                            placeholder="16 digit (jika ada)"
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="Status Aktif">
                                        <Select
                                            name="status_aktif"
                                            value={form.status_aktif}
                                            onChange={(e) => update("status_aktif", e.target.value as StatusAktif)}
                                            options={[
                                                {value: "aktif", label: "Aktif"},
                                                {value: "nonaktif", label: "Nonaktif"},
                                            ]}
                                        />
                                    </Field>

                                    <Field className="md:col-span-6" label="Nama Lengkap" required
                                           error={requiredErrors.nama_lengkap}>
                                        <Input
                                            name="nama_lengkap"
                                            value={form.nama_lengkap}
                                            onChange={(e) => update("nama_lengkap", e.target.value)}
                                            placeholder="Nama sesuai KTP"
                                            invalid={!!requiredErrors.nama_lengkap}
                                        />
                                    </Field>

                                    <Field className="md:col-span-3" label="Nama Panggilan (opsional)">
                                        <Input
                                            name="nama_panggilan"
                                            value={form.nama_panggilan}
                                            onChange={(e) => update("nama_panggilan", e.target.value)}
                                            placeholder="Mis: Udin"
                                        />
                                    </Field>

                                    <Field className="md:col-span-3" label="Jenis Kelamin">
                                        <Select
                                            name="jenis_kelamin"
                                            value={form.jenis_kelamin}
                                            onChange={(e) => update("jenis_kelamin", e.target.value as JenisKelamin)}
                                            options={[
                                                {value: "L", label: "Laki-laki"},
                                                {value: "P", label: "Perempuan"},
                                            ]}
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="Tempat Lahir (opsional)">
                                        <Input
                                            name="tempat_lahir"
                                            value={form.tempat_lahir}
                                            onChange={(e) => update("tempat_lahir", e.target.value)}
                                            placeholder="Kota/Kab"
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="Tanggal Lahir (opsional)">
                                        <Input
                                            name="tanggal_lahir"
                                            type="date"
                                            value={form.tanggal_lahir}
                                            onChange={(e) => update("tanggal_lahir", e.target.value)}
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="Agama (opsional)">
                                        <Input
                                            name="agama"
                                            value={form.agama}
                                            onChange={(e) => update("agama", e.target.value)}
                                            placeholder="Kosongkan jika tidak diperlukan"
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <Section icon={<GraduationCap className="h-5 w-5"/>} title="Status & Pendidikan"
                                     subtitle="Variabel pengelompokan tenaga kerja.">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                    <Field className="md:col-span-6" label="Status Perkawinan">
                                        <Select
                                            name="status_perkawinan"
                                            value={form.status_perkawinan}
                                            onChange={(e) => update("status_perkawinan", e.target.value as StatusPerkawinan)}
                                            options={[
                                                {value: "Belum Kawin", label: "Belum Kawin"},
                                                {value: "Kawin", label: "Kawin"},
                                                {value: "Cerai", label: "Cerai"},
                                            ]}
                                        />
                                    </Field>

                                    <Field className="md:col-span-6" label="Pendidikan Terakhir">
                                        <Select
                                            name="pendidikan_terakhir"
                                            value={form.pendidikan_terakhir}
                                            onChange={(e) => update("pendidikan_terakhir", e.target.value as Pendidikan)}
                                            options={[
                                                {value: "SD", label: "SD"},
                                                {value: "SMP", label: "SMP"},
                                                {value: "SMA/SMK", label: "SMA/SMK"},
                                                {value: "D1", label: "D1"},
                                                {value: "D2", label: "D2"},
                                                {value: "D3", label: "D3"},
                                                {value: "D4", label: "D4"},
                                                {value: "S1", label: "S1"},
                                                {value: "S2", label: "S2"},
                                                {value: "S3", label: "S3"},
                                                {value: "Lainnya", label: "Lainnya"},
                                            ]}
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <Section icon={<Phone className="h-5 w-5"/>} title="Kontak"
                                     subtitle="Data komunikasi untuk koordinasi lapangan & administrasi.">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                    <Field className="md:col-span-6" label="No HP" required
                                           error={requiredErrors.no_hp}>
                                        <Input
                                            name="no_hp"
                                            value={form.no_hp}
                                            inputMode="tel"
                                            onChange={(e) => update("no_hp", onlyDigits(e.target.value))}
                                            placeholder="08xxxxxxxxxx"
                                            invalid={!!requiredErrors.no_hp}
                                        />
                                    </Field>

                                    <Field className="md:col-span-6" label="Email (opsional)">
                                        <Input
                                            name="email"
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => update("email", e.target.value)}
                                            placeholder="nama@email.com"
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <Section icon={<MapPin className="h-5 w-5"/>} title="Alamat"
                                     subtitle="Pisahkan alamat KTP dan domisili (kalau berbeda).">
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    {/* KTP */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-4">
                                            <h3 className="text-base font-bold text-slate-900">Alamat KTP</h3>
                                            <p className="text-sm text-slate-500">Wajib minimal alamat +
                                                kota/provinsi.</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                            <Field className="md:col-span-12" label="Alamat KTP" required
                                                   error={requiredErrors.alamat_ktp}>
                                                <Textarea
                                                    name="alamat_ktp"
                                                    value={form.alamat_ktp}
                                                    onChange={(e) => update("alamat_ktp", e.target.value)}
                                                    placeholder="Jalan, RT/RW, No Rumah, Dusun/Perumahan"
                                                    rows={3}
                                                    invalid={!!requiredErrors.alamat_ktp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kelurahan/Desa">
                                                <Input
                                                    name="kelurahan_ktp"
                                                    value={form.kelurahan_ktp}
                                                    onChange={(e) => update("kelurahan_ktp", e.target.value)}
                                                    placeholder="Kel/Desa"
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kecamatan">
                                                <Input
                                                    name="kecamatan_ktp"
                                                    value={form.kecamatan_ktp}
                                                    onChange={(e) => update("kecamatan_ktp", e.target.value)}
                                                    placeholder="Kecamatan"
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kota/Kab" required
                                                   error={requiredErrors.kota_kab_ktp}>
                                                <Input
                                                    name="kota_kab_ktp"
                                                    value={form.kota_kab_ktp}
                                                    onChange={(e) => update("kota_kab_ktp", e.target.value)}
                                                    placeholder="Kota/Kabupaten"
                                                    invalid={!!requiredErrors.kota_kab_ktp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Provinsi" required
                                                   error={requiredErrors.provinsi_ktp}>
                                                <Input
                                                    name="provinsi_ktp"
                                                    value={form.provinsi_ktp}
                                                    onChange={(e) => update("provinsi_ktp", e.target.value)}
                                                    placeholder="Provinsi"
                                                    invalid={!!requiredErrors.provinsi_ktp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kode Pos">
                                                <Input
                                                    name="kode_pos_ktp"
                                                    value={form.kode_pos_ktp}
                                                    inputMode="numeric"
                                                    maxLength={5}
                                                    onChange={(e) => update("kode_pos_ktp", onlyDigits(e.target.value))}
                                                    placeholder="5 digit"
                                                />
                                            </Field>
                                        </div>
                                    </div>

                                    {/* Domisili */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900">Alamat Domisili</h3>
                                                <p className="text-sm text-slate-500">Jika sama, centang “Sama dengan
                                                    KTP”.</p>
                                            </div>

                                            <label
                                                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={sameAsKtp}
                                                    onChange={(e) => handleSameAsKtpToggle(e.target.checked)}
                                                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                                                />
                                                Sama dengan KTP
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                            <Field className="md:col-span-12" label="Alamat Domisili">
                                                <Textarea
                                                    name="alamat_domisili"
                                                    value={form.alamat_domisili}
                                                    onChange={(e) => update("alamat_domisili", e.target.value)}
                                                    placeholder="Jalan, RT/RW, No Rumah, Dusun/Perumahan"
                                                    rows={3}
                                                    disabled={sameAsKtp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kelurahan/Desa">
                                                <Input
                                                    name="kelurahan_domisili"
                                                    value={form.kelurahan_domisili}
                                                    onChange={(e) => update("kelurahan_domisili", e.target.value)}
                                                    placeholder="Kel/Desa"
                                                    disabled={sameAsKtp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kecamatan">
                                                <Input
                                                    name="kecamatan_domisili"
                                                    value={form.kecamatan_domisili}
                                                    onChange={(e) => update("kecamatan_domisili", e.target.value)}
                                                    placeholder="Kecamatan"
                                                    disabled={sameAsKtp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kota/Kab">
                                                <Input
                                                    name="kota_kab_domisili"
                                                    value={form.kota_kab_domisili}
                                                    onChange={(e) => update("kota_kab_domisili", e.target.value)}
                                                    placeholder="Kota/Kabupaten"
                                                    disabled={sameAsKtp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Provinsi">
                                                <Input
                                                    name="provinsi_domisili"
                                                    value={form.provinsi_domisili}
                                                    onChange={(e) => update("provinsi_domisili", e.target.value)}
                                                    placeholder="Provinsi"
                                                    disabled={sameAsKtp}
                                                />
                                            </Field>

                                            <Field className="md:col-span-6" label="Kode Pos">
                                                <Input
                                                    name="kode_pos_domisili"
                                                    value={form.kode_pos_domisili}
                                                    inputMode="numeric"
                                                    maxLength={5}
                                                    onChange={(e) => update("kode_pos_domisili", onlyDigits(e.target.value))}
                                                    placeholder="5 digit"
                                                    disabled={sameAsKtp}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                </div>
                            </Section>

                            <Section icon={<ShieldCheck className="h-5 w-5"/>} title="Kontak Darurat"
                                     subtitle="Penting untuk kebutuhan lapangan & keselamatan kerja.">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                    <Field className="md:col-span-5" label="Nama Kontak Darurat">
                                        <Input
                                            name="kontak_darurat_nama"
                                            value={form.kontak_darurat_nama}
                                            onChange={(e) => update("kontak_darurat_nama", e.target.value)}
                                            placeholder="Nama keluarga/kerabat"
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="Hubungan">
                                        <Input
                                            name="kontak_darurat_hubungan"
                                            value={form.kontak_darurat_hubungan}
                                            onChange={(e) => update("kontak_darurat_hubungan", e.target.value)}
                                            placeholder="Orang tua/Istri/Suami/Saudara"
                                        />
                                    </Field>

                                    <Field className="md:col-span-3" label="No HP">
                                        <Input
                                            name="kontak_darurat_no_hp"
                                            value={form.kontak_darurat_no_hp}
                                            inputMode="tel"
                                            onChange={(e) => update("kontak_darurat_no_hp", onlyDigits(e.target.value))}
                                            placeholder="08xxxxxxxxxx"
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <Section icon={<Landmark className="h-5 w-5"/>} title="Legal & Kepesertaan"
                                     subtitle="Opsional, sering diminta untuk administrasi vendor/klien.">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                    <Field className="md:col-span-4" label="NPWP (opsional)">
                                        <Input name="npwp" value={form.npwp}
                                               onChange={(e) => update("npwp", e.target.value)}
                                               placeholder="Nomor NPWP"/>
                                    </Field>

                                    <Field className="md:col-span-4" label="BPJS Kesehatan (opsional)">
                                        <Input
                                            name="bpjs_kesehatan"
                                            value={form.bpjs_kesehatan}
                                            onChange={(e) => update("bpjs_kesehatan", e.target.value)}
                                            placeholder="Nomor BPJS"
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="BPJS Ketenagakerjaan (opsional)">
                                        <Input
                                            name="bpjs_ketenagakerjaan"
                                            value={form.bpjs_ketenagakerjaan}
                                            onChange={(e) => update("bpjs_ketenagakerjaan", e.target.value)}
                                            placeholder="Nomor BPJS TK"
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <Section icon={<Landmark className="h-5 w-5"/>} title="Informasi Bank"
                                     subtitle="Opsi bank mengikuti daftar yang kamu berikan.">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                    <Field className="md:col-span-4" label="Nama Bank" required
                                           error={requiredErrors.bank_nama}>
                                        <GroupedSelect
                                            name="bank_nama"
                                            value={form.bank_nama}
                                            onChange={(e) => update("bank_nama", e.target.value)}
                                            placeholder="Pilih bank..."
                                            groups={BANK_GROUPS}
                                            invalid={!!requiredErrors.bank_nama}
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="No Rekening" required
                                           error={requiredErrors.bank_no_rekening}>
                                        <Input
                                            name="bank_no_rekening"
                                            value={form.bank_no_rekening}
                                            inputMode="numeric"
                                            onChange={(e) => update("bank_no_rekening", onlyDigits(e.target.value))}
                                            placeholder="Nomor rekening"
                                            invalid={!!requiredErrors.bank_no_rekening}
                                        />
                                    </Field>

                                    <Field className="md:col-span-4" label="Nama Pemilik Rekening" required
                                           error={requiredErrors.bank_nama_pemilik}>
                                        <Input
                                            name="bank_nama_pemilik"
                                            value={form.bank_nama_pemilik}
                                            onChange={(e) => update("bank_nama_pemilik", e.target.value)}
                                            placeholder="Sesuai buku tabungan"
                                            invalid={!!requiredErrors.bank_nama_pemilik}
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <Section icon={<FileText className="h-5 w-5"/>} title="Lainnya"
                                     subtitle="Field tambahan untuk pengelolaan internal.">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                    <Field className="md:col-span-6" label="Foto URL (opsional)">
                                        <Input name="foto_url" value={form.foto_url}
                                               onChange={(e) => update("foto_url", e.target.value)}
                                               placeholder="https://..."/>
                                    </Field>

                                    <Field className="md:col-span-3" label="Tanggal Masuk (opsional)">
                                        <Input name="tanggal_masuk" type="date" value={form.tanggal_masuk}
                                               onChange={(e) => update("tanggal_masuk", e.target.value)}/>
                                    </Field>

                                    <Field className="md:col-span-12" label="Catatan (opsional)">
                                        <Textarea
                                            name="catatan"
                                            value={form.catatan}
                                            onChange={(e) => update("catatan", e.target.value)}
                                            placeholder="Catatan khusus (mis. preferensi proyek, batasan kerja, dll)."
                                            rows={4}
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Link
                                    href="/dashboard/pegawai"
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                    Batal
                                </Link>

                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className={cn(
                                        "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold shadow-sm transition",
                                        canSubmit ? "bg-slate-900 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-200 text-slate-500"
                                    )}
                                >
                                    <Save className="h-4 w-4"/>
                                    {saving ? "Menyimpan..." : isEdit ? "Update Data Pegawai" : "Simpan Data Pegawai"}
                                </button>
                            </div>
                        </form>
                    </main>

                    <Footer/>
                </div>
            </div>
        </div>
    );
}

/* ===========================
   UI Helpers (Tailwind-only)
   =========================== */

function Section({
                     title,
                     subtitle,
                     icon,
                     children,
                 }: {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
                        {icon ?? <ClipboardList className="h-5 w-5"/>}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900">{title}</h2>
                        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
}

function Field({
                   label,
                   required,
                   error,
                   className,
                   children,
               }: {
    label: string;
    required?: boolean;
    error?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-slate-700">
                    {label} {required && <span className="text-rose-600">*</span>}
                </label>
                {error && <span className="text-xs font-semibold text-rose-600">{error}</span>}
            </div>
            {children}
        </div>
    );
}

function Input({
                   className,
                   invalid,
                   ...props
               }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string; invalid?: boolean }) {
    return (
        <input
            {...props}
            className={cn(
                "w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition",
                "placeholder:text-slate-400 focus:ring-4",
                invalid ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200/60" : "border-slate-200 focus:border-slate-400 focus:ring-slate-200/60",
                props.disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
                className
            )}
            aria-invalid={invalid ? "true" : "false"}
        />
    );
}

function Textarea({
                      className,
                      invalid,
                      ...props
                  }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string; invalid?: boolean }) {
    return (
        <textarea
            {...props}
            className={cn(
                "w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition",
                "placeholder:text-slate-400 focus:ring-4",
                invalid ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200/60" : "border-slate-200 focus:border-slate-400 focus:ring-slate-200/60",
                props.disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
                className
            )}
            aria-invalid={invalid ? "true" : "false"}
        />
    );
}

function Select({
                    options,
                    className,
                    ...props
                }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: Array<{ value: string; label: string }>;
    className?: string;
}) {
    return (
        <select
            {...props}
            className={cn(
                "w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition",
                "focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60",
                props.disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
                className
            )}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

function GroupedSelect({
                           groups,
                           placeholder,
                           className,
                           invalid,
                           ...props
                       }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    groups: Array<{ label: string; options: Array<{ value: string; label: string }> }>;
    placeholder?: string;
    className?: string;
    invalid?: boolean;
}) {
    return (
        <select
            {...props}
            className={cn(
                "w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition",
                "focus:ring-4",
                invalid ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200/60" : "border-slate-200 focus:border-slate-400 focus:ring-slate-200/60",
                props.disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
                className
            )}
            aria-invalid={invalid ? "true" : "false"}
        >
            <option value="">{placeholder ?? "Pilih..."}</option>
            {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                        <option key={`${g.label}-${o.value}`} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}
