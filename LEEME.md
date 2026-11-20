# Poli Social Network

Red social universitaria para la comunidad del Politécnico Colombiano Jaime Isaza Cadavid (PJIC). Reúne estudiantes y docentes de las sedes Medellín, Urabá y Rionegro en un muro, foros académicos, una red de seguidores y mensajería en tiempo real.

## Tecnologías

- **Web:** React con Next.js y TypeScript.
- **Backend:** Node.js con TypeScript, API REST y eventos en tiempo real por WebSocket (Socket.IO).
- **Datos:** MongoDB Atlas / MongoDB local con índices, validadores y catálogo institucional.
- **Multimedia:** Sharp, FFmpeg y FFprobe convierten imágenes y videos. Los estados y los adjuntos privados usan GridFS. El acceso institucional con Firebase es opcional.

## Estado actual

Implementado en el backend:

- Registro y perfil universitario, edición de perfil y propagación de `authorSnapshot` y `participantsInfo`.
- Seguidores con contadores atómicos y transacciones, bloqueos entre usuarios y notificaciones internas.
- Muro con filtros «Todo el Poli», «Mi Sede» y «Siguiendo», paginación por cursor y avisos fijados.
- Publicaciones en los canales GENERAL, ACADEMICO, PROYECTOS, AVISOS y MERCADO.
- Likes idempotentes, comentarios, eliminación lógica y marcación de «Respuesta Solucionada».
- Chats directos y grupales, mensajes idempotentes con `clientMsgId`, contadores de no leídos y lectura.
- Eventos en tiempo real por Socket.IO y centro de notificaciones.
- Validación de entrada, manejo centralizado de errores y autorización por rol.
- Administración de cuentas con roles de usuario, moderador y administrador; perfiles separados de estudiante, profesor y página institucional.
- Baneos temporales auditados, inhabilitación de cuentas sin borrado físico y restablecimiento de contraseña con cambio obligatorio.
- Catálogos administrativos de perfiles, carreras, sedes y categorías institucionales. Los registros solo se inhabilitan y permanecen en MongoDB.
- Páginas verificadas, cuentas institucionales vinculadas, comunidades y reportes con cola de moderación.
- Reacciones `LIKE`, `DISLIKE`, `LOVE`, `FUN` y `AMAZED`, cargas de imágenes, videos y documentos en almacenamiento local de desarrollo.

Implementado en la web:

- Interfaz responsiva de tres columnas con feed, foros por canal, mensajería y perfil.
- Paleta verde y dorado del Poli, modo claro/oscuro y pantalla de acceso.
- Muro, publicaciones, comentarios, reacciones, páginas, comunidades, archivos, administración y reportes conectados a la API.
- Mensajes privados y grupos con adjuntos, lectura, actualización por Socket.IO e indicador de escritura.
- Estados durante 24 horas con fotos de 15 segundos y videos de hasta 120 segundos.
- Encuestas, preguntas, foros, eventos, ubicaciones, guardados y enlaces a publicaciones.

El proyecto sigue en desarrollo. Los archivos dependen del disco local del servidor; antes de producción falta almacenamiento durable, recuperación de cuenta, controles antiabuso, respaldos y monitoreo.


## Carpetas

```text
polihub/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/                  rutas Next.js: grupos (social) y (administracion)
│   │       ├── modulos/              pantallas y servicios por función
│   │       ├── componentes_compartidos/ elementos reutilizados
│   │       ├── datos/                modelos y etiquetas de la interfaz
│   │       └── servicios/            cliente HTTP común
│   └── backend/
│       └── src/
│           ├── servidor.ts           punto de entrada de la API
│           ├── comun/                autenticación, permisos y validación compartidos
│           ├── infraestructura/      conexión, HTTP, archivos y tiempo real
│           ├── modulos/              rutas y lógica agrupadas por función
│           └── scripts/              tareas ejecutables, como cuentas iniciales
├── configuracion/
│   ├── base_datos/                   preparación inicial de MongoDB
│   └── firebase/                     reglas de almacenamiento
├── docs/                             arquitectura y plan de trabajo
├── LEEME.md                          instalación y uso
└── tecnologias.txt                   tecnologías y su función
```

**Diferencia clave:** `configuracion/` contiene scripts que se ejecutan al preparar los servicios. `apps/backend/src/infraestructura/` contiene el código que usa la API mientras está funcionando. No son copias entre sí.

Dentro de cada módulo del backend, `rutas.ts` declara URLs, `controladores.ts` atiende HTTP, `servicios.ts` aplica reglas de negocio y `repositorio.ts` consulta MongoDB. Algunos módulos todavía están migrándose a esa separación.

El mapa, el diagrama de clases y el esquema de colecciones están en [`docs/diagrama-clases-colecciones.md`](docs/diagrama-clases-colecciones.md). El avance y las etapas pendientes están en [`docs/inventario-y-plan-reorganizacion.md`](docs/inventario-y-plan-reorganizacion.md).

## Puesta en marcha

### 1. Base de datos

El backend lee `MONGODB_URI` y `MONGODB_BASE_DATOS` desde `apps/backend/.env`. La configuración de ejemplo usa MongoDB local (`mongodb://localhost:27017`) y la base `polihub`. Asegúrate de que MongoDB esté iniciado antes de levantar el backend.

Para usar Atlas, reemplaza `MONGODB_URI` en `apps/backend/.env` por la cadena de conexión del clúster y configura sus credenciales en Atlas. Mantén esa cadena únicamente en `.env`; no la publiques ni la subas al repositorio.

Inicializa validadores, índices y datos de referencia. Para Atlas, reemplaza la URI local de `mongosh` por la cadena del clúster:

```bash
mongosh "mongodb://localhost:27017/polihub" configuracion/base_datos/crear_validadores.js
mongosh "mongodb://localhost:27017/polihub" configuracion/base_datos/crear_indices.js
mongosh "mongodb://localhost:27017/polihub" configuracion/base_datos/datos_iniciales.js
```

### 2. Backend

```bash
cd apps/backend
npm install
copy .env.example .env
npm run cuentas:iniciales
npm run dev
```

Desde la raíz del monorepositorio también puedes iniciar la API con `npm run desarrollo:api` y la web con `npm run desarrollo:web`. La web queda en `http://localhost:3000` y la API en `http://localhost:3001`.

Revisa que `MONGODB_URI` y `MONGODB_BASE_DATOS` en `.env` apunten a la instancia que inicializaste. Configura `AUTH_TOKEN_SECRET` con un valor aleatorio privado de al menos 32 caracteres.

`cuentas:iniciales` crea un administrador, un moderador, una cuenta de estudiante, una de profesor y la página institucional Bienestar. La contraseña inicial del administrador se genera una sola vez y aparece en la terminal. En las demás cuentas iniciales, la contraseña temporal coincide con el nombre de usuario. Todas deben cambiar la contraseña al entrar. El script no modifica cuentas que ya existan.

Las cuentas usan dos campos distintos: `role` define permisos (`USER`, `MODERATOR`, `ADMIN`) y `accountType` identifica el perfil (`STUDENT`, `TEACHER`, `PAGE`). En el panel Administración, el administrador puede crear cuentas y roles, restablecer contraseñas, cambiar permisos, banear o inhabilitar cuentas. El moderador puede aplicar y retirar baneos por 30 días con motivos registrados.

La API queda en `http://localhost:3001/api`. Sin `FIREBASE_API_KEY`, el acceso se valida contra las cuentas locales y sus contraseñas. Si se configura Firebase, el backend también admite los ID tokens de Firebase.

### 3. Web

```bash
cd apps/web
npm install
npm run dev
```

La web queda en `http://localhost:3000`.



## Demostración y permisos

Desde la raíz, `npm run demostracion --workspace poli-social-network-backend` prepara los autores y contenidos locales de ejemplo. Usa identificadores estables para conservar las publicaciones editadas o retiradas. Los accesos de demostración se escriben en `usuarios_prueba.txt` y `credenciales_admin_y_reporte.txt`. Para restablecer expresamente las claves de esos ejemplos, añade `-- --restablecer-ejemplos`. El acceso por defecto se utiliza en desarrollo local.

Administración y moderación comparten el muro de consulta, los reportes y la creación de páginas con acceso propio. En `/admin`, el administrador también gestiona cuentas, verifica páginas y consulta auditoría, carreras y listas. Solo el fundador administra otras cuentas administrativas. Los estudiantes y docentes cambian a sus propias páginas desde el selector de identidad. Las páginas delegadas usan las credenciales de su titular.

## Calidad

`npm run verificar` comprueba tipos y `npm run compilar` construye ambas aplicaciones. La web guarda la compilación de producción en `.next-produccion` para poder seguir usando el servidor de desarrollo. `npm run pruebas` ejecuta las suites de API con MongoDB de pruebas local. Para comprobar la interfaz con el sitio iniciado, ejecuta `node --test pruebas/interfaz.mjs` en `apps/web`. El informe de alcance y resultados se encuentra en `docs/informe-calidad.txt`.

## Endpoints principales

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/salud` | Estado del servicio |
| POST | `/api/autenticacion/registro` | Crear una cuenta local con contraseña |
| POST | `/api/autenticacion/sesion` | Iniciar sesión local |
| PATCH | `/api/autenticacion/mi-contrasena` | Cambiar una contraseña temporal o propia |
| GET/POST | `/api/administracion/usuarios` | Listar o crear cuentas (moderación también puede crear páginas institucionales) |
| PATCH/DELETE | `/api/administracion/usuarios/:id/baneo` | Aplicar o retirar un baneo temporal |
| POST | `/api/administracion/usuarios/:id/restablecer-contrasena` | Restablecer contraseña (solo administrador) |
| PATCH | `/api/administracion/usuarios/:id/rol` | Cambiar permiso (solo administrador) |
| PATCH | `/api/administracion/usuarios/:id/estado` | Inhabilitar o rehabilitar una cuenta |
| POST | `/api/usuarios` | Registro del usuario autenticado con Firebase |
| GET | `/api/usuarios/:id` | Perfil público |
| GET/PATCH | `/api/usuarios/mi-perfil` | Perfil propio |
| POST/DELETE | `/api/usuarios/:id/seguir` | Seguir o dejar de seguir |
| POST/DELETE | `/api/usuarios/:id/bloqueo` | Bloquear o desbloquear |
| GET | `/api/publicaciones?vista=sede&hubChannel=ACADEMICO` | Muro paginado por cursor |
| POST | `/api/publicaciones` | Crear publicación o tema de foro |
| GET/PATCH/DELETE | `/api/publicaciones/:id` | Detalle, edición y eliminación lógica |
| POST/DELETE | `/api/publicaciones/:id/likes` | Reaccionar o retirar like |
| POST | `/api/publicaciones/:id/comentarios` | Comentar |
| POST | `/api/publicaciones/:id/comentarios/:comentarioId/solucion` | Marcar solución |
| POST | `/api/paginas/:id/identidad` | Entrar a una página propia |
| PATCH | `/api/paginas/:id/verificacion` | Conceder o retirar la insignia de una página |
| GET/POST | `/api/estados` | Consultar o publicar un estado |
| GET | `/api/estados/:id/archivo` | Ver un estado vigente con sesión |
| PATCH | `/api/estados/:id/retirar` | Retirar un estado propio |
| GET | `/api/chats` | Bandeja de conversaciones |
| POST | `/api/chats/directos` | Crear o reutilizar chat 1 a 1 |
| POST | `/api/chats/grupos` | Crear grupo de estudio |
| GET/POST | `/api/chats/:id/mensajes` | Historial y envío de mensajes |
| POST | `/api/chats/:id/leido` | Marcar conversación como leída |
| GET | `/api/notificaciones` | Centro de notificaciones |
| POST | `/api/notificaciones/:id/leido` | Marcar notificación como leída |

Las rutas de contenido y gestión requieren `Authorization: Bearer <token>`. El registro local, el inicio de sesión, la salud del servicio y las opciones públicas de registro se consultan antes de iniciar sesión.

## Verificación

```bash
npm run verificar
npm run compilar
```

La prueba de humo del backend requiere MongoDB disponible y cubre registro, seguimiento, publicación, like, comentario, solución, chat, mensaje y notificaciones.

## Despliegue independiente en Railway

Crea dos servicios desde el mismo repositorio. Para la web, configura el directorio raíz `/apps/web` y la ruta del archivo de configuración `/apps/web/railway.toml`. Para la API usa `/apps/backend` y `/apps/backend/railway.toml`. Cada servicio tiene su propio package.json, archivo de bloqueo, compilación y comando de arranque. Usa Node.js 22.12 o superior de la serie 22 en ambos servicios.

Genera un dominio HTTPS para cada servicio. En la web configura `NEXT_PUBLIC_API_URL=https://<dominio-api>/api` antes de compilar. En la API establece `ORIGEN_WEB=https://<dominio-web>`, `MONGODB_URI`, `MONGODB_BASE_DATOS` y un `AUTH_TOKEN_SECRET` aleatorio de al menos 32 caracteres. El proveedor asigna `PORT`. Configura un volumen en la API en `/datos/archivos` y establece `UPLOADS_DIR=/datos/archivos` para conservar fotos, videos y documentos entre despliegues. Los estados y los adjuntos privados del chat se guardan en MongoDB.

En la base seleccionada aplica los scripts de `configuracion/base_datos` con mongosh: primero `crear_validadores.js`, después `crear_indices.js` y finalmente `actualizar-categorias-paginas.js` para instalaciones existentes. Conserva los secretos de MongoDB en el servicio API. Las cuentas y los datos de demostración son para desarrollo local.

[Monorrepositorios en Railway](https://docs.railway.com/deployments/monorepo) · [Volúmenes persistentes](https://docs.railway.com/volumes/reference)
