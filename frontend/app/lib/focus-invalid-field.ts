export interface CampoValidable {
  key: string;
  elementId: string;
}

/**
 * Lleva la vista al primer control con error y le da el foco.
 *
 * Los errores se muestran junto a cada campo; si el formulario es largo, el
 * usuario debe ver el primero aunque haya hecho submit desde el final.
 */
export function enfocarPrimerCampoInvalido(
  errores: Record<string, string | null | undefined>,
  campos: readonly CampoValidable[]
): boolean {
  const primero = campos.find(({ key }) => Boolean(errores[key]));
  if (!primero || typeof document === "undefined") return false;

  const elemento = document.getElementById(primero.elementId);
  if (!elemento) return false;

  if (typeof elemento.scrollIntoView === "function") {
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  elemento.focus({ preventScroll: true });
  return true;
}
