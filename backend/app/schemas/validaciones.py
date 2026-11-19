import re

_PATRON_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def normalizar_email(valor: str) -> str:
    """Normaliza una dirección de correo y valida su formato."""
    email = valor.strip().lower()
    if not _PATRON_EMAIL.fullmatch(email):
        raise ValueError("Debe ingresar un correo electrónico válido")
    return email
