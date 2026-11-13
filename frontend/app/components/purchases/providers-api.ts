import { apiRequest } from "~/lib/api";
import type { Address } from "~/lib/address";
import type { Provider } from "./purchases-types";

interface ProviderApi {
  banco: string;
  cuenta: string;
  cuit: string;
  direccion: {
    altura: string;
    calle: string;
    cp: string;
    depto: string;
    localidad: string;
    provincia: string;
  };
  email: string;
  id_proveedor: string;
  razon_social: string;
  saldo: number | string;
  telefono: string;
}

export interface ProviderPayload {
  banco: string;
  cuenta: string;
  cuit: string;
  direccion: ProviderApi["direccion"];
  email: string;
  razon_social: string;
  telefono: string;
}

export function mapProvider(data: ProviderApi): Provider {
  const address: Address = {
    province: data.direccion.provincia,
    locality: data.direccion.localidad,
    street: data.direccion.calle,
    number: data.direccion.altura,
    apartment: data.direccion.depto,
    postalCode: data.direccion.cp,
  };
  return {
    id: data.id_proveedor,
    name: data.razon_social,
    cuit: data.cuit,
    phone: data.telefono,
    email: data.email,
    address,
    bank: data.banco,
    account: data.cuenta,
    balance: Number(data.saldo),
  };
}

export function providerPayload(provider: Provider): ProviderPayload {
  return {
    banco: provider.bank,
    cuenta: provider.account,
    cuit: provider.cuit,
    direccion: {
      altura: provider.address.number,
      calle: provider.address.street,
      cp: provider.address.postalCode ?? "",
      depto: provider.address.apartment,
      localidad: provider.address.locality,
      provincia: provider.address.province,
    },
    email: provider.email,
    razon_social: provider.name,
    telefono: provider.phone,
  };
}

export async function listProviders(): Promise<Provider[]> {
  const data = await apiRequest<ProviderApi[]>("/proveedores?limit=200");
  return data.map(mapProvider);
}

export async function getProvider(id: string): Promise<Provider> {
  return mapProvider(await apiRequest<ProviderApi>(`/proveedores/${id}`));
}

export async function createProvider(
  payload: ProviderPayload
): Promise<Provider> {
  return mapProvider(
    await apiRequest<ProviderApi>("/proveedores", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
}

export async function updateProviderApi(
  id: string,
  payload: ProviderPayload
): Promise<Provider> {
  return mapProvider(
    await apiRequest<ProviderApi>(`/proveedores/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  );
}

export function deleteProviderApi(id: string): Promise<void> {
  return apiRequest<void>(`/proveedores/${id}`, { method: "DELETE" });
}
