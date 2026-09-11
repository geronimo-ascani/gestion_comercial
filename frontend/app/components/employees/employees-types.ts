export const employeeRoleLabels = {
  ventas: "Ventas",
  abastecimiento: "Abastecimiento",
  administrador: "Administrador",
} as const;

export type EmployeeRole = keyof typeof employeeRoleLabels;

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  cuil: string;
  phone: string;
  email: string;
  hireDate: string;
  role: EmployeeRole;
  password?: string;
}