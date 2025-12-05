"use client";

import { useState } from "react";
import AuthCard from "@/components/AuthCard";
import InputField from "@/components/InputField";
import SubmitButton from "@/components/SubmitButton";
import { postJSON } from "@/lib/api";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await postJSON("/auth/login", form);
      // asumsi backend mengirim { token: "..." }
      localStorage.setItem("token", result.token);
      alert("Login sukses!");
      window.location.href = "/dashboard";
    } catch (err: any) {
      alert(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Masuk ke Akun">
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Email"
          name="email"
          type="email"
          value={form.email}
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

        <SubmitButton loading={loading} label="Masuk" />

        <p className="text-center mt-3 text-gray-600">
          Belum punya akun?{" "}
          <a
            href="/register"
            className="text-blue-600 font-medium hover:underline"
          >
            Daftar
          </a>
        </p>
      </form>
    </AuthCard>
  );
}
