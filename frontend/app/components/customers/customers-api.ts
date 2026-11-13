import { apiRequest } from "~/lib/api";
import type { Address } from "~/lib/address";
import type { Customer } from "./customers-types";

interface CustomerApi {
  apellido: string;
  condicion_iva_descripcion: string;
  direccion: {
    altura: string;
    calle: string;
    cp: string;
    depto: string;
    localidad: string;
    provincia: string;
  };
  dni_cuit: string;
  email: string;
  id_cliente: string;
  id_condicion_iva: string;
  nombre: string;
  saldo: number | string;
  telefono: string;
}

export interface CondicionIVA {
  codigo_afip: string;
  descripcion: string;
  id_condicion_iva: string;
}

export interface CustomerPayload {
  apellido: string;
  dni_cuit: string;
  direccion: {
    altura: string;
    calle: string;
    cp: string;
    depto: string;
    localidad: string;
    provincia: string;
  };
  email: string;
  id_condicion_iva: string;
  nombre: string;
  telefono: string;
}

function mapAddress(address: CustomerApi["direccion"]): Address {
  return {
    province: address.provincia,
    locality: address.localidad,
    street: address.calle,
    number: address.altura,
    apartment: address.depto,
    postalCode: address.cp,
  };
}

export function mapCustomer(data: CustomerApi): Customer {
  return {
    id: data.id_cliente,
    firstName: data.nombre,
    lastName: data.apellido,
    document: data.dni_cuit,
    phone: data.telefono,
    email: data.email,
    address: mapAddress(data.direccion),
    balance: Number(data.saldo),
    taxConditionId: data.id_condicion_iva,
    taxCondition: data.condicion_iva_descripcion,
  };
}

function addressPayload(address: Address): CustomerPayload["direccion"] {
  return {
    altura: address.number,
    calle: address.street,
    cp: address.postalCode ?? "",
    depto: address.apartment,
    localidad: address.locality,
    provincia: address.province,
  };
}

export function customerPayload(customer: Customer): CustomerPayload {
  return {
    apellido: customer.lastName,
    dni_cuit: customer.document,
    direccion: addressPayload(customer.address),
    email: customer.email,
    id_condicion_iva: customer.taxConditionId ?? "",
    nombre: customer.firstName,
    telefono: customer.phone,
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const data = await apiRequest<CustomerApi[]>("/clientes?limit=200");
  return data.map(mapCustomer);
}

export async function getCustomer(id: string): Promise<Customer> {
  return mapCustomer(await apiRequest<CustomerApi>(`/clientes/${id}`));
}

export async function createCustomer(
  payload: CustomerPayload
): Promise<Customer> {
  return mapCustomer(
    await apiRequest<CustomerApi>("/clientes", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
}

export async function updateCustomerApi(
  id: string,
  payload: CustomerPayload
): Promise<Customer> {
  return mapCustomer(
    await apiRequest<CustomerApi>(`/clientes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  );
}

export function deleteCustomerApi(id: string): Promise<void> {
  return apiRequest<void>(`/clientes/${id}`, { method: "DELETE" });
}

export function listTaxConditions(): Promise<CondicionIVA[]> {
  return apiRequest<CondicionIVA[]>("/condiciones-iva");
}
