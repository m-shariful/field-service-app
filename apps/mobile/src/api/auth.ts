import { apiGet, apiPostPublic } from "./client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };
}

export interface MeResponse {
  data: AuthUser;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return apiPostPublic<AuthResponse>("/api/auth/register", input);
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return apiPostPublic<AuthResponse>("/api/auth/login", input);
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  return apiPostPublic<AuthResponse>("/api/auth/google", {
    idToken,
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await apiPostPublic<{
    data: {
      success: boolean;
    };
  }>("/api/auth/logout", {
    refreshToken,
  });
}

export async function getCurrentUser(): Promise<MeResponse> {
  return apiGet<MeResponse>("/api/auth/me");
}
