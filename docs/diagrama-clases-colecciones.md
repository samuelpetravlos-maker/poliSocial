# Esquema de clases y colecciones de Poli Social Network

## Arquitectura que existe hoy

La web usa Next.js App Router, React y TypeScript. Las pantallas se escriben como componentes TSX en `apps/web/src/app` y los módulos de interfaz viven en `apps/web/src/modulos`. TSX genera HTML en el navegador; el proyecto no mantiene páginas `.html` tradicionales.

La API usa Express y TypeScript. MongoDB se accede con el controlador oficial `mongodb`; el proyecto no usa Mongoose ni clases `Schema` de Mongoose. Los tipos TypeScript describen los documentos; `apps/backend/src/infraestructura/base_datos` gestiona la conexión, mientras que los scripts de `configuracion/base_datos` preparan índices, validadores BSON y datos iniciales.

## Clases y componentes principales

### Web

- **Aplicación Next.js** (`apps/web/src/app`): páginas y diseños reservados por el marco, entre ellos `page.tsx` y `layout.tsx`.
- **Módulos de interfaz** (`apps/web/src/modulos/[modulo]`): agrupan vistas, controladores y servicios relacionados con autenticación, inicio, publicaciones, chats, comunidades, páginas, archivos, notificaciones, usuarios, moderación y administración.
- **Pantalla principal**: coordina la experiencia social y sus paneles. Encabezado, navegación y compositor ya son vistas separadas; la normalización de respuestas del servidor está en adaptadores del módulo de inicio. La pantalla aún requiere descomposición adicional.
- **Administración y moderación** comparten la navegación, el muro de consulta, los foros y las acciones contextuales. El administrador accede también a las herramientas de cuentas, verificación, catálogos, resumen y auditoría en `/admin`.
- **Catálogos administrativos**: gestiona perfiles de cuenta, carreras, sedes y categorías de páginas. Los elementos se pueden habilitar o inhabilitar, no borrar; se auditan las operaciones.
- **Vista de moderación**: muro de consulta y acciones contextuales; el rol no recibe capacidades de publicación, perfil social o reacciones.

### Backend

- **`Autenticacion`** (`comun/autenticacion.ts`): valida la sesión y carga la cuenta asociada.
- **Matriz de capacidades** (`comun/permisos.ts`): relaciona rol con operaciones permitidas; rutas y servicios aplican además reglas de propiedad, estado y contexto.
- **Configuración de origen** (`comun/configuracion.ts`): define el origen web permitido para HTTP y Socket.IO.
- **Rutas HTTP** (`infraestructura/http/rutas.ts`): registra las rutas de cada módulo bajo `/api`.
- **Organización de la API.** Cada módulo expone sus rutas. En administración, los controladores de cuentas atienden las operaciones de usuarios y permisos, y los servicios y repositorios gestionan las reglas y la persistencia. Estados y mensajería incorporan almacenamiento de archivos con GridFS.
- **Adaptador de almacenamiento local** (`infraestructura/archivos/almacenamiento-local.ts`): persiste archivos fuera de la lógica HTTP y permite sustituir el proveedor.
- **MongoDB**: conexión en `apps/backend/src/infraestructura/base_datos`; validadores, índices y datos iniciales en `configuracion/base_datos`.
- **Tiempo real** (`infraestructura/tiempo-real/eventos.ts`): emite eventos de Socket.IO y permite invalidar sesiones conectadas.

## Colecciones MongoDB

Los nombres existentes se conservan para evitar romper datos y contratos. Los documentos usan BSON y no esquemas Mongoose. Los tipos siguientes son una guía de lectura del código, no una migración automática.

### `users` — cuentas y autenticación

```ts
{
  _id: string,                 // local_<usuario> o identificador externo
  email: string,
  username: string,
  displayName: string,
  role: 'USER' | 'MODERATOR' | 'ADMIN',
  accountType: 'STUDENT' | 'TEACHER' | 'PAGE',
  accountLabel?: string,      // Etiqueta configurable del perfil
  accountProfileId?: string,
  passwordHash?: string,
  localAuth?: boolean,
  mustChangePassword?: boolean,
  sessionVersion?: number,
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED',
  banUntil?: Date,
  banReason?: string,
  avatarUrl: string | null,
  campus: string,
  createdAt: Date,
  updatedAt: Date
}
```

`role` define permisos de acceso; `accountType` define si la identidad representa estudiante, profesor o página. Las publicaciones, reportes, páginas y chats enlazan a la cuenta mediante su `_id` de tipo cadena.

### `posts` — publicaciones

```ts
{
  _id: ObjectId,
  authorId: string,
  pageId: string | null,
  title: string | null,
  formato?: 'NOTICIA' | 'ENCUESTA' | 'PREGUNTA' | 'FORO' | 'EVENTO',
  opcionesEncuesta?: string[],
  ubicacion?: string | null,
  fechaEvento?: Date,
  content: string,
  mediaUrls: string[],
  tags: string[],
  likesCount: number,
  commentsCount: number,
  status: 'VISIBLE' | 'HIDDEN_BY_MOD' | 'DELETED',
  createdAt: Date,
  updatedAt: Date
}
```

`authorId` referencia `users._id`; `pageId` identifica una página cuando publica una página. Los comentarios y reacciones guardan `postId` como `ObjectId`.

### `comments` y `reactions`

```ts
// comments
{ _id: ObjectId, postId: ObjectId, authorId: string, text: string,
  isAcceptedAnswer: boolean, status: string, createdAt: Date }

// reactions
{ _id: ObjectId, postId: ObjectId, userId: string,
  type: 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED', createdAt: Date }
```

`authorId` y `userId` referencian `users._id`. Hay un índice único de reacción por publicación y usuario.

### `pages` — páginas institucionales

```ts
{
  _id: ObjectId,
  nombre: string,
  nombreNormalizado: string,
  descripcion: string,
  categoria: string,
  propietarioId: string,
  seguidores: number,
  isVerified: boolean,
  verificationStatus: 'UNREQUESTED' | 'PENDING' | 'VERIFIED' | 'REJECTED',
  verifiedBy?: string | null,
  verifiedAt?: Date | null,
  createdAt: Date
}
```

`propietarioId` y `verifiedBy` identifican documentos de `users`. En una página con acceso directo, el propietario es la cuenta institucional. En una página delegada, el propietario es su titular personal. Al usarla se crea una identidad social con el identificador `pagina_<ObjectId>`, para que publicaciones, comentarios y mensajes mantengan la autoría correcta.

### `communities` — comunidades

```ts
{
  _id: ObjectId,
  nombre: string,
  descripcion: string,
  sede: string,
  categoria: string,
  tipoAcceso: string,
  miembros: string[],
  solicitudes: string[],
  invitados: string[],
  creadorId: string,
  chatIdAsociado: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

Los identificadores de miembros y creador apuntan a `users._id`; `chatIdAsociado` enlaza al chat vinculado cuando existe.

### Catálogos institucionales

- `campuses`: `_id` con código de sede, `name`, `city` y `status` (`ACTIVE` o `INACTIVE`).
- `programs`: `_id` con código, `name`, `faculty`, `campuses` (códigos), `semesters` y `status`.
- `accountTypes`: `_id`, `name`, `baseType` (`STUDENT`, `TEACHER` o `PAGE`), `builtin` y `status`. La etiqueta del perfil se guarda en la cuenta para conservarla aunque el catálogo se inhabilite.
- `pageCategories`: `_id`, `name`, `builtin` y `status`.

Administración puede crear y habilitar/inhabilitar elementos. No existe operación de borrado de catálogos. Las cuentas existentes mantienen sus datos al inhabilitar una opción; los formularios de cuentas nuevas solo muestran opciones activas. Los permisos de acceso `USER`, `MODERATOR` y `ADMIN` siguen definidos por el sistema y no se editan como perfiles académicos.

### `chats` y `messages`

```ts
// chats
{ _id: ObjectId, type: 'DIRECT' | 'GROUP', participantIds: string[],
  participantsInfo: object, lastMessage: object | null, unreadCounts: object,
  createdBy: string, updatedAt: Date }

// messages
{ _id: ObjectId, chatId: ObjectId, senderId: string,
  senderName: string, text?: string, mediaUrl?: string,
  readBy: string[], createdAt: Date }
```

`chatId` enlaza a `chats._id`; participantes y remitente identifican cuentas de `users`.

### `notifications` — notificaciones

```ts
{
  _id: ObjectId,
  userId: string,
  type: string,
  actorSnapshot: object | null,
  refType: 'POST' | 'COMMENT' | 'USER' | 'REPORT' | null,
  refId: string | null,
  isRead: boolean,
  createdAt: Date
}
```

`userId` es el destinatario; `refType` y `refId` identifican el recurso relacionado. Los registros vencen según el índice de expiración configurado.

### `reports` — reportes de contenido

```ts
{
  _id: ObjectId,
  reporterId: string,
  targetType: 'POST' | 'COMMENT' | 'USER' | 'PAGE' | 'MESSAGE',
  targetId: string,
  reason: string,
  details: string,
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED',
  assignedTo: string | null,
  resolution: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

`reporterId` y `assignedTo` identifican cuentas. `targetType` determina qué colección consultar usando `targetId`.

### `auditLogs` — auditoría

```ts
{ _id: ObjectId, actorId: string, actorRole: string, action: string,
  targetType: string, targetId: string, details: object | null, createdAt: Date }
```

Conserva las operaciones de administración y moderación cuando se inhabilita una cuenta.

### Encuestas y publicaciones guardadas

- `votosEncuesta` guarda `publicacionId: ObjectId`, `usuarioId: string` y `opcion: number`. La clave compuesta de publicación e identidad impide votar dos veces. El cambio de opción actualiza el mismo documento.
- `publicacionesGuardadas` vincula `usuarioId: string` con `postId: ObjectId`. El indicador `activa: boolean` permite quitar y volver a guardar una referencia. La fecha sirve para ordenar la lista personal.

### Estados y adjuntos privados de chat

- El almacén GridFS `estados` distribuye metadatos y contenido entre `estados.files` y `estados.chunks`. Los metadatos incluyen autor, tipo de archivo, segundos de reproducción, fecha de vencimiento y retirada. La API filtra esos campos y los bloqueos entre cuentas antes de entregar contenido.
- El almacén GridFS `adjuntosChat` guarda el identificador del chat, el autor y el tipo del archivo en sus metadatos. Cada descarga comprueba que la persona autenticada pertenece al chat correspondiente.

## Índices y compatibilidad

La inicialización de base de datos define índices de unicidad para correo/usuario, nombre normalizado de página y reacción por usuario/publicación, además de índices para búsquedas y orden temporal. El índice de notificaciones aplica expiración; los reportes activos evitan duplicados por usuario y objetivo.

Los nombres de colecciones y varios campos están en inglés por compatibilidad histórica. Traducirlos requiere migración con respaldo, escritura/lectura compatible durante el despliegue, verificación de conteos y procedimiento de reversión. No se debe renombrar datos directamente como parte de una reorganización de carpetas.

## Discrepancia pendiente

El validador BSON de `users.role` conserva valores históricos `STUDENT` y `TEACHER`, mientras el modelo de ejecución usa `USER`, `MODERATOR` y `ADMIN`, y expresa el tipo de identidad mediante `accountType`. Antes de endurecer el validador se debe revisar si existen documentos con roles antiguos y migrarlos de forma controlada.
