import { apiRequest } from "~/lib/api";

import type { Employee, EmployeeRole } from "../employees/employees-types";

export interface UsuarioApi {
  apellido: string;
  dni_cuil: string;
  email: string;
  fecha_alta: string;
  fecha_ingreso: string;
  fecha_modificacion: string | null;
  id_empleado: string;
  nombre: string;
  puesto: string;
  rol: EmployeeRole;
  telefono: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
}

export interface RegisterResponse {
  access_token: string | null;
  token_type: "bearer";
  user: UsuarioApi;
}

export interface RegisterPayload {
  apellido: string;
  dni_cuil: string;
  email: string;
  fecha_ingreso: string;
  nombre: string;
  password: string;
  rol: EmployeeRole;
  telefono: string;
}

export function mapUsuario(usuario: UsuarioApi): Employee {
  return {
    id: usuario.id_empleado,
    firstName: usuario.nombre,
    lastName: usuario.apellido,
    cuil: usuario.dni_cuil,
    phone: usuario.telefono,
    email: usuario.email,
    hireDate: new Date(`${usuario.fecha_ingreso}T00:00:00`).toLocaleDateString(
      "es-AR"
    ),
    role: usuario.rol,
  };
}

export function iniciarSesion(
  email: string,
  password: string
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function registrarUsuario(
  datos: RegisterPayload
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function obtenerUsuarioActual(): Promise<Employee> {
  const data = await apiRequest<UsuarioApi>("/auth/me");
  return mapUsuario(data);
}

export async function listarEmpleados(): Promise<Employee[]> {
  const data = await apiRequest<UsuarioApi[]>("/auth/employees");
  return data.map(mapUsuario);
}

export async function solicitarRecuperacion(email: string): Promise<void> {
  await apiRequest<{ message: string }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function restablecerContrasena(
  token: string,
  password: string
): Promise<void> {
  await apiRequest<void>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
