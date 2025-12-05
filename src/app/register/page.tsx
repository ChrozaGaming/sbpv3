"use client";

import { useState } from "react";
import AuthCard from "@/components/AuthCard";
import InputField from "@/components/InputField";
import SubmitButton from "@/components/SubmitButton";
import { postJSON } from "@/lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({
    nama_lengkap: "",
    email: "",
    no_hp: "",
    password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await postJSON("/auth/register", form);
      alert("Registrasi berhasil!");
      window.location.href = "/login";
    } catch (err: any) {
      alert(err.message);
    }

    setLoading(false);
  }

  return (
    <AuthCard title="Buat Akun Baru">
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Nama Lengkap"
          name="nama_lengkap"
          value={form.nama_lengkap}
          onChange={handleChange}
          required
        />

        <InputField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <InputField
          label="No Handphone"
          name="no_hp"
          value={form.no_hp}
          onChange={handleChange}
          required
        />

        <InputField
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <InputField
          label="Konfirmasi Password"
          name="confirm_password"
          type="password"
          value={form.confirm_password}
          onChange={handleChange}
          required
        />

        <SubmitButton loading={loading} label="Daftar" />

        <p className="text-center mt-3 text-gray-600">
          Sudah punya akun?{" "}
          <a href="/login" className="text-blue-600 font-medium hover:underline">
            Login
          </a>
        </p>
      </form>
    </AuthCard>
  );
}
