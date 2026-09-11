import type { Address } from "~/lib/address";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  document: string;
  phone: string;
  email: string;
  address: Address;
}