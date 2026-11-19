from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Request,
    Response,
    status,
)

from app.api.security import (
    CurrentUser,
    ServiceDep,
    get_current_user,
    require_roles,
)
from app.schemas.auth import (
    CredencialesLogin,
    RegistroEmpleado,
    RegistroResponse,
    RestablecerContrasena,
    SolicitudRecuperacion,
    TokenRead,
    UsuarioRead,
)
from app.schemas.empleados import (
    EmpleadoCreate,
    EmpleadoPasswordUpdate,
    EmpleadoRead,
    EmpleadoUpdate,
)
from app.services.auth_service import (
    AuthDatosDuplicados,
    CredencialesInvalidas,
    EmpleadoEnUso,
    EmpleadoNoEncontrado,
    EmpleadoSinCambios,
    EmailNoConfigurado,
    ErrorEnvioEmail,
    LimiteIntentosExcedido,
    TokenRecuperacionInvalido,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])
EmpleadoId = Annotated[str, Path(min_length=1, max_length=20)]
SoloAdministrador = Annotated[
    dict,
    Depends(require_roles("administrador")),
]


@router.post("/login", response_model=TokenRead)
def iniciar_sesion(
    datos: CredencialesLogin,
    service: ServiceDep,
    request: Request,
) -> TokenRead:
    try:
        service.verificar_limite_intentos(
            f"login:{request.client.host if request.client else 'unknown'}",
            5,
            60,
        )
    except LimiteIntentosExcedido as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Esperá un minuto y volvé a probar.",
            headers={"Retry-After": "60"},
        ) from exc
    try:
        token, _ = service.autenticar(datos.email, datos.password)
    except CredencialesInvalidas as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales no válidas.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return TokenRead(access_token=token)


@router.post("/register", response_model=RegistroResponse, status_code=201)
def registrar(
    datos: RegistroEmpleado,
    service: ServiceDep,
    request: Request,
) -> RegistroResponse:
    try:
        service.verificar_limite_intentos(
            f"register:{request.client.host if request.client else 'unknown'}",
            5,
            3600,
        )
    except LimiteIntentosExcedido as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Se alcanzó el límite de registros. Volvé a intentarlo más tarde.",
            headers={"Retry-After": "3600"},
        ) from exc
    try:
        token, usuario = service.registrar_publico(datos.model_dump())
    except AuthDatosDuplicados as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo o DNI/CUIL.",
        ) from exc
    return RegistroResponse(
        access_token=token,
        user=UsuarioRead.model_validate(usuario),
    )


@router.get("/me", response_model=UsuarioRead)
def obtener_sesion(usuario_actual: CurrentUser) -> UsuarioRead:
    return UsuarioRead.model_validate(usuario_actual)


@router.get("/employees", response_model=list[EmpleadoRead])
def listar_empleados(
    usuario_actual: SoloAdministrador,
    service: ServiceDep,
) -> list[EmpleadoRead]:
    return [
        EmpleadoRead.model_validate(usuario)
        for usuario in service.listar_usuarios(usuario_actual["id_empresa"])
    ]


@router.post("/employees", response_model=EmpleadoRead, status_code=201)
def crear_empleado(
    datos: EmpleadoCreate,
    usuario_actual: SoloAdministrador,
    service: ServiceDep,
) -> EmpleadoRead:
    try:
        empleado = service.registrar_empleado(
            datos.model_dump(),
            usuario_actual["id_empresa"],
        )
    except AuthDatosDuplicados as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo o DNI/CUIL.",
        ) from exc
    return EmpleadoRead.model_validate(empleado)


@router.get("/employees/{id_empleado}", response_model=EmpleadoRead)
def obtener_empleado(
    id_empleado: EmpleadoId,
    usuario_actual: SoloAdministrador,
    service: ServiceDep,
) -> EmpleadoRead:
    empleado = service.obtener_empleado(
        id_empleado, usuario_actual["id_empresa"]
    )
    if empleado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el empleado '{id_empleado}'",
        )
    return EmpleadoRead.model_validate(empleado)


@router.patch("/employees/{id_empleado}", response_model=EmpleadoRead)
def actualizar_empleado(
    datos: EmpleadoUpdate,
    id_empleado: EmpleadoId,
    usuario_actual: SoloAdministrador,
    service: ServiceDep,
) -> EmpleadoRead:
    try:
        empleado = service.actualizar_usuario(
            id_empleado,
            datos.model_dump(exclude_unset=True),
            usuario_actual["id_empresa"],
        )
    except EmpleadoNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el empleado '{id_empleado}'",
        ) from exc
    except AuthDatosDuplicados as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo o DNI/CUIL.",
        ) from exc
    except EmpleadoSinCambios as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No se enviaron campos para actualizar.",
        ) from exc
    return EmpleadoRead.model_validate(empleado)


@router.put(
    "/employees/{id_empleado}/password",
    status_code=status.HTTP_204_NO_CONTENT,
)
def actualizar_contrasena_empleado(
    datos: EmpleadoPasswordUpdate,
    id_empleado: EmpleadoId,
    usuario_actual: SoloAdministrador,
    service: ServiceDep,
) -> Response:
    try:
        service.actualizar_contrasena_empleado(
            id_empleado,
            datos.password,
            usuario_actual["id_empresa"],
        )
    except EmpleadoNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el empleado '{id_empleado}'",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/employees/{id_empleado}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_empleado(
    id_empleado: EmpleadoId,
    usuario_actual: SoloAdministrador,
    service: ServiceDep,
) -> Response:
    try:
        service.eliminar_usuario(
            id_empleado, usuario_actual["id_empresa"]
        )
    except EmpleadoNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el empleado '{id_empleado}'",
        ) from exc
    except EmpleadoEnUso as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "El empleado tiene pedidos o registros de auditoría asociados "
                "y no se puede eliminar"
            ),
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password/forgot", status_code=202)
def solicitar_recuperacion(
    datos: SolicitudRecuperacion,
    service: ServiceDep,
    request: Request,
) -> dict[str, str]:
    try:
        service.verificar_limite_intentos(
            f"password-reset:{request.client.host if request.client else 'unknown'}",
            3,
            3600,
        )
    except LimiteIntentosExcedido as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Se alcanzó el límite de solicitudes. Volvé a intentarlo más tarde.",
            headers={"Retry-After": "3600"},
        ) from exc
    try:
        service.solicitar_recuperacion(datos.email)
    except EmailNoConfigurado as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La recuperación por correo no está configurada en el servidor.",
        ) from exc
    except ErrorEnvioEmail as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo enviar el correo de recuperación.",
        ) from exc
    return {
        "message": "Si el correo está registrado, recibirás un enlace para restablecer la contraseña."
    }


@router.post("/password/reset", status_code=204)
def restablecer_contrasena(
    datos: RestablecerContrasena,
    service: ServiceDep,
) -> None:
    try:
        service.restablecer_contrasena(datos.token, datos.password)
    except TokenRecuperacionInvalido as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace no es válido o expiró.",
        ) from exc


# Reexportado para los routers que todavía importan desde este módulo.
__all__ = ["router", "get_current_user", "require_roles"]
