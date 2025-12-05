export interface RegisterPayload {
  nama_lengkap: string;
  email: string;
  no_hp: string;
  password: string;
  confirm_password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
