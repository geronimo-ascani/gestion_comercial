import { describe, expect, it } from "vitest";

import {
  esEmailValido,
  normalizarEmail,
  parsearListaEmails,
} from "./email";

describe("helpers de correo", () => {
  it("normaliza mayúsculas y espacios", () => {
    expect(normalizarEmail("  Cliente@Example.COM  ")).toBe(
      "cliente@example.com",
    );
  });

  it("valida el formato del correo", () => {
    expect(esEmailValido("cliente@example.com")).toBe(true);
    expect(esEmailValido("cliente@example")).toBe(false);
    expect(esEmailValido("no-es-un-email")).toBe(false);
    expect(esEmailValido("")).toBe(false);
  });

  it("parsea lista separada por comas o puntos y coma y quita duplicados", () => {
    expect(
      parsearListaEmails(
        " Uno@Example.com ; dos@example.com,uno@example.com;; ",
      ),
    ).toEqual(["uno@example.com", "dos@example.com"]);
  });
});
