// app/surat-jalan-creator/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Truck, Save, Search, X } from 'lucide-react';

// --- INTERFACES ---
interface Barang {
  id: number;
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok_sisa: number;
}

interface SelectedBarang extends Barang {
  jumlah: number;
}

// --- DATA MOCK (Simulasi data stok karena tidak ada /api/stok) ---
const mockStok: Barang[] = [
  { id: 1, kode: 'SMT-001', nama: 'Semen Portland Tipe I', kategori: 'Material', satuan: 'sak', stok_sisa: 500 },
  { id: 2, kode: 'BJR-12', nama: 'Besi Beton Polos D12', kategori: 'Besi', satuan: 'batang', stok_sisa: 120 },
  { id: 3, kode: 'PB-250', nama: 'Pipa PVC AW Ø 2.5"', kategori: 'Pipa', satuan: 'batang', stok_sisa: 85 },
  { id: 4, kode: 'CRS-01', nama: 'Kabel Listrik NYM 3x2.5', kategori: 'Elektrikal', satuan: 'roll', stok_sisa: 35 },
  { id: 5, kode: 'KAYU-MR', nama: 'Kayu Meranti Balok 5x10', kategori: 'Kayu', satuan: 'm3', stok_sisa: 25 },
];
// --- AKHIR DATA MOCK ---

// --- KOMPONEN UTAMA ---
const SuratJalanPage = () => {
  const [stok, setStok] = useState<Barang[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarang, setSelectedBarang] = useState<SelectedBarang[]>([]);
  const [form, setForm] = useState({
    tujuan: '',
    nomorSurat: '',
    tanggal: new Date().toISOString().slice(0, 10),
    nomorKendaraan: '',
    noPo: '',
    keteranganProyek: '',
  });
  const [currentBarang, setCurrentBarang] = useState<SelectedBarang>({
    id: 0,
    kode: '',
    nama: '',
    kategori: '',
    satuan: '',
    jumlah: 1,
    stok_sisa: 0,
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch data stok (Menggunakan MOCK DATA)
  useEffect(() => {
    // Simulasi fetch API
    setIsLoading(true);
    setTimeout(() => {
        setStok(mockStok);
        setIsLoading(false);
    }, 500);
    // Jika Anda ingin mengaktifkan fetch API sebenarnya, ganti dengan:
    // const fetchStok = async () => { ... }
    // fetchStok();
  }, []);

  // 2. Debounce & Filtering
  const filteredStok = useMemo(() => {
    if (!searchQuery.trim() || currentBarang.id !== 0) {
      return []; 
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    return stok.filter(
      (item) =>
        item.nama.toLowerCase().includes(lowerCaseQuery) ||
        item.kode.toLowerCase().includes(lowerCaseQuery)
    ).slice(0, 10);
  }, [searchQuery, stok, currentBarang.id]);

  // 3. Handler Form Utama
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    
    if (formErrors[name]) {
      const newErrors = { ...formErrors };
      delete newErrors[name];
      setFormErrors(newErrors);
    }
  };

  // 4. Handler Select Barang
  const handleSelectBarang = (item: Barang) => {
    setCurrentBarang({
      ...item,
      jumlah: 1,
    });
    setSearchQuery(`${item.nama} (${item.kode})`);
  };

  // 5. Handler Tambah Barang
  const addBarang = () => {
    if (currentBarang.id === 0 || currentBarang.jumlah <= 0) {
      alert('Mohon pilih barang dan masukkan jumlah yang valid.');
      return;
    }

    const jumlah = parseFloat(currentBarang.jumlah.toFixed(2));
    const stokBarang = stok.find((item) => item.id === currentBarang.id);

    if (stokBarang && stokBarang.stok_sisa < jumlah) {
      alert(`Stok barang tidak mencukupi. Sisa stok: ${stokBarang.stok_sisa} ${stokBarang.satuan}`);
      return;
    }

    const isDuplicate = selectedBarang.some((item) => item.id === currentBarang.id);

    if (isDuplicate) {
      alert('Barang ini sudah ada di daftar. Hapus dulu jika ingin mengubah jumlah.');
      return;
    }

    setSelectedBarang((prev) => [...prev, { ...currentBarang, jumlah }]);
    
    // Reset input barang
    setCurrentBarang({ ...currentBarang, id: 0 }); 
    setSearchQuery('');
  };

  // 6. Handler Remove Barang
  const removeBarang = (id: number) => {
    setSelectedBarang((prev) => prev.filter((item) => item.id !== id));
  };
  
  // 7. Reset Barang
  const resetBarang = () => {
    setSelectedBarang([]);
  };

  // 8. Validasi Form
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!form.tujuan.trim()) errors.tujuan = 'Tujuan wajib diisi.';
    if (!form.nomorSurat.trim()) errors.nomorSurat = 'Nomor Surat wajib diisi.';
    if (!form.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
    if (selectedBarang.length === 0) errors.barang = 'Minimal satu barang harus ditambahkan.';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 9. Handler Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      alert('⚠️ Mohon lengkapi kolom yang wajib diisi dan pastikan ada barang di daftar.');
      return;
    }
    
    setIsLoading(true);

    // --- SIMULASI PENYIMPANAN DATA ---
    console.log('--- DATA SURAT JALAN SIAP DISIMPAN ---');
    console.log('Form Data:', form);
    console.log('Barang Data:', selectedBarang.map(item => ({
        kode: item.kode,
        nama: item.nama,
        jumlah: item.jumlah,
        satuan: item.satuan,
    })));

    setTimeout(() => {
        alert('✅ Surat Jalan berhasil dibuat! (Simulasi)');
        
        // Reset Form & Daftar Barang
        setForm({
            tujuan: '',
            nomorSurat: '',
            tanggal: new Date().toISOString().slice(0, 10),
            nomorKendaraan: '',
            noPo: '',
            keteranganProyek: '',
        });
        setSelectedBarang([]);
        setIsLoading(false);
    }, 1500);

    // Jika menggunakan API nyata, gunakan kode seperti di jawaban sebelumnya
  };

  // --- KOMPONEN INPUT KECIL (Helper Component) ---
  const InputGroup = ({ label, name, value, type = "text", placeholder, required = false, isInvalid = false, errorText = "", className = "" }: { label: string, name: string, value: string, type?: string, placeholder?: string, required?: boolean, isInvalid?: boolean, errorText?: string, className?: string }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-lg border ${isInvalid ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'} shadow-sm p-2.5 transition-colors ${className}`}
            placeholder={placeholder}
            required={required}
        />
        {isInvalid && (
            <p className="mt-1 text-xs text-red-500 font-medium">{errorText}</p>
        )}
    </div>
  );

  return (
    <div className="bg-gray-100 min-h-screen p-5 sm:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Halaman */}
        <div className="flex items-center justify-between bg-white p-6 rounded-xl shadow-lg mb-8">
          <h1 className="flex items-center text-3xl font-extrabold text-blue-700">
            <Truck className="w-8 h-8 mr-3 text-blue-500" /> Buat Surat Jalan Baru
          </h1>
          <button
            type="submit"
            className="flex items-center px-6 py-3 text-lg font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition duration-150 shadow-md disabled:bg-gray-400"
            onClick={handleSubmit}
            disabled={isLoading || selectedBarang.length === 0 || Object.keys(formErrors).length > 0}
          >
            {isLoading ? 'Menyimpan...' : (
                <>
                    <Save className="w-5 h-5 mr-2" />
                    SIMPAN & FINALISASI SJ
                </>
            )}
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Bagian 1: Data Header Surat Jalan */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                <h2 className="text-xl font-semibold text-gray-800 mb-5 border-b pb-2">Informasi Dasar Pengiriman</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <InputGroup
                            label="Tujuan Pengiriman (Nama Klien/Proyek)"
                            name="tujuan"
                            value={form.tujuan}
                            placeholder="Nama PT, Toko, atau Alamat Proyek"
                            required
                            isInvalid={!!formErrors.tujuan}
                            errorText={formErrors.tujuan}
                        />
                    </div>
                    <InputGroup
                        label="Tanggal Surat"
                        name="tanggal"
                        value={form.tanggal}
                        type="date"
                        required
                        isInvalid={!!formErrors.tanggal}
                        errorText={formErrors.tanggal}
                    />
                    <InputGroup
                        label="Nomor Surat Jalan"
                        name="nomorSurat"
                        value={form.nomorSurat}
                        placeholder="Contoh: SJ/2025/12/001"
                        required
                        isInvalid={!!formErrors.nomorSurat}
                        errorText={formErrors.nomorSurat}
                        className="font-mono"
                    />
                    <InputGroup
                        label="Nomor Kendaraan"
                        name="nomorKendaraan"
                        value={form.nomorKendaraan}
                        placeholder="Plat Mobil/Truk (e.g., B 1234 XY)"
                    />
                    <InputGroup
                        label="Nomor PO (Purchase Order)"
                        name="noPo"
                        value={form.noPo}
                        placeholder="Nomor PO dari klien (Opsional)"
                    />
                </div>
                <div className="mt-6">
                    {/* Menggunakan textarea untuk Keterangan Proyek agar bisa lebih panjang */}
                    <label className="block text-sm font-medium text-gray-700">Keterangan Proyek/Tambahan</label>
                    <textarea
                        name="keteranganProyek"
                        value={form.keteranganProyek}
                        onChange={handleInputChange}
                        rows={3}
                        className="mt-1 block w-full rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm p-2.5 transition-colors"
                        placeholder="Detail tambahan, misal: 'Pengiriman Tahap I Proyek ABC'"
                    />
                </div>
            </div>

            {/* Bagian 2: Daftar Barang (Item List) */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 mb-5 border-b pb-2">Daftar Barang Keluar</h2>
                
                {/* Form Pencarian Barang (Autocomplete) */}
                <div className="border p-4 rounded-lg bg-gray-50 mb-5">
                    <h3 className="font-bold text-gray-700 mb-3">Tambah Item Barang <span className="text-red-500">*</span></h3>
                    <div className="flex flex-wrap items-end gap-4">
                        
                        <div className="relative flex-grow min-w-[200px]">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Cari Barang (Kode/Nama)</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={isLoading ? "Memuat data stok..." : "Ketik kode atau nama barang..."}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        // Reset currentBarang ID ke 0 untuk menampilkan dropdown
                                        setCurrentBarang(prev => ({ ...prev, id: 0 })); 
                                    }}
                                    className="border border-gray-300 rounded-lg p-2.5 pl-10 w-full focus:border-blue-500 focus:ring-blue-500 transition disabled:bg-gray-200"
                                    disabled={isLoading}
                                />
                                {currentBarang.id !== 0 && (
                                    <X 
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500 cursor-pointer hover:text-red-700" 
                                        onClick={() => {
                                            setCurrentBarang(prev => ({ ...prev, id: 0 }));
                                            setSearchQuery('');
                                        }}
                                    />
                                )}
                            </div>
                            
                            {/* Suggestion Dropdown */}
                            {searchQuery && currentBarang.id === 0 && filteredStok.length > 0 && (
                                <ul className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-xl w-full max-h-48 overflow-y-auto mt-1">
                                    {filteredStok.map((item) => (
                                        <li
                                            key={item.id}
                                            className="px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                                            onClick={() => handleSelectBarang(item)}
                                        >
                                            <span className="font-medium">{item.nama}</span>
                                            <span className="text-xs text-gray-500 ml-2">({item.kode} | Stok: {item.stok_sisa} {item.satuan})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {searchQuery && filteredStok.length === 0 && currentBarang.id === 0 && !isLoading && (
                                <div className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-xl w-full mt-1 p-3 text-sm text-gray-500">
                                    Barang tidak ditemukan.
                                </div>
                            )}
                        </div>
                        
                        {/* Status Barang Terpilih */}
                        {currentBarang.id !== 0 && (
                            <div className="flex flex-col flex-1 min-w-[150px] p-2 bg-blue-100 rounded-lg text-sm">
                                <span className="font-semibold text-blue-800">Dipilih: {currentBarang.nama}</span>
                                <span className="text-xs text-blue-600">Stok Sisa: {currentBarang.stok_sisa} {currentBarang.satuan}</span>
                            </div>
                        )}

                        {/* Input Jumlah */}
                        <div className="w-full sm:w-1/4 min-w-[120px]">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Jumlah</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                value={currentBarang.jumlah !== 0 ? currentBarang.jumlah.toString().replace('.', ',') : '1'}
                                onChange={(e) => {
                                    const input = e.target.value;
                                    const jumlah = parseFloat(input.replace(',', '.'));
                                    setCurrentBarang({
                                        ...currentBarang,
                                        jumlah: !isNaN(jumlah) && jumlah > 0 ? jumlah : 1,
                                    });
                                }}
                                className="border border-gray-300 rounded-lg p-2.5 w-full text-center font-semibold focus:border-blue-500 focus:ring-blue-500"
                                placeholder="1,00"
                                disabled={currentBarang.id === 0}
                            />
                        </div>

                        {/* Tombol Tambah */}
                        <button
                            type="button"
                            onClick={addBarang}
                            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-150 h-[42px] mt-4 sm:mt-0 disabled:bg-gray-400"
                            disabled={currentBarang.id === 0 || currentBarang.jumlah <= 0}
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    {formErrors.barang && (
                        <p className="mt-3 text-sm text-red-500 font-medium border-l-4 border-red-500 pl-2 bg-red-50">{formErrors.barang}</p>
                    )}
                </div>

                {/* Tabel Daftar Barang Terpilih */}
                <div className="overflow-x-auto border rounded-lg shadow-inner">
                    {selectedBarang.length > 0 ? (
                        <table className="w-full min-w-max">
                            <thead className="bg-gray-200 uppercase text-xs text-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-center border-r">No</th>
                                    <th className="px-4 py-3 text-left border-r">Kode</th>
                                    <th className="px-4 py-3 text-left border-r">Nama Barang</th>
                                    <th className="px-4 py-3 text-center border-r">Kategori</th>
                                    <th className="px-4 py-3 text-center border-r">Jumlah Keluar</th>
                                    <th className="px-4 py-3 text-center border-r">Satuan</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {selectedBarang.map((item, index) => (
                                    <tr key={item.id} className="text-sm hover:bg-yellow-50/50 transition-colors">
                                        <td className="px-4 py-2 text-center">{index + 1}</td>
                                        <td className="px-4 py-2 font-mono text-gray-600">{item.kode}</td>
                                        <td className="px-4 py-2 font-medium">{item.nama}</td>
                                        <td className="px-4 py-2 text-center">{item.kategori}</td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-700">{item.jumlah.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                                        <td className="px-4 py-2 text-center">{item.satuan}</td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={() => removeBarang(item.id)}
                                                className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                                                type="button"
                                                title="Hapus Barang"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center p-6 text-gray-500">
                            Gunakan kolom pencarian di atas untuk menambahkan barang ke daftar ini.
                        </div>
                    )}
                </div>
                
                {selectedBarang.length > 0 && (
                    <button
                        type="button"
                        onClick={resetBarang}
                        className="mt-4 flex items-center px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition shadow-md"
                    >
                        <X className="w-4 h-4 mr-1" />
                        Bersihkan Semua Barang
                    </button>
                )}
            </div>
            
        </form>
        
        {/* Tidak ada komponen DataSuratJalan atau Riwayat di sini sesuai permintaan */}
        
      </div>
    </div>
  );
};

export default SuratJalanPage;