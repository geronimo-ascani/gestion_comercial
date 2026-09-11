export interface Address {
  province: string;
  locality: string;
  street: string;
  number: string;
  apartment: string;
}

export const emptyAddress: Address = {
  province: "",
  locality: "",
  street: "",
  number: "",
  apartment: "",
};

export function formatAddress(address: Address | null | undefined): string {
  if (!address) return "";
  const parts: string[] = [];
  const streetLine = [address.street, address.number].filter(Boolean).join(" ");
  if (streetLine) parts.push(streetLine);
  if (address.apartment) parts.push(`Dpto. ${address.apartment}`);
  if (address.locality) parts.push(address.locality);
  if (address.province) parts.push(address.province);
  return parts.join(", ");
}