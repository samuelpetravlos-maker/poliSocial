# Inventario y plan de reorganización de Poli Social Network

Este archivo recoge el diagnóstico y el plan iniciales. La implementación posterior unificó la interfaz de administración y moderación, separó el controlador de cuentas e incorporó estados y mensajería. Consulta el [informe de implementación y pruebas](informe-calidad.txt) y el [esquema actualizado](diagrama-clases-colecciones.md) para conocer la versión actual.

## Propósito

Reorganizar el software de forma incremental, conservar los flujos que ya funcionan y cerrar las brechas de arquitectura, permisos, datos, experiencia y operación. Moodle y Facebook son referentes de producto y diseño: Poli Social Network no será una copia de ninguno.

## Inventario técnico inicial

- Monorepositorio npm con `apps/web` y `apps/backend`.
- Web: Next.js 15, React 19, TypeScript y App Router. Las vistas se escriben en TSX; no hay páginas HTML manuales.
- API: Node.js, Express 4 y TypeScript; MongoDB con el controlador oficial `mongodb` (no Mongoose); Socket.IO está disponible en el backend.
- Hay 86 archivos fuente TS/TSX en las aplicaciones.
- Módulos actuales del backend: administración, archivos, autenticación, chats, comunidades, moderación, notificaciones, páginas, publicaciones y usuarios.
- Módulos actuales de la web: administración, archivos, autenticación, chats, comunidades, inicio, moderación, páginas, publicaciones y usuarios.
- La web y la API son procesos separados en desarrollo (`3000` y `3001`). En producción pueden servirse bajo un dominio mediante un proxy `/api`.
- CORS estaba abierto a cualquier origen cuando faltaba `ORIGEN_WEB`; ahora el desarrollo usa `http://localhost:3000` y producción exige configuración explícita.
- El árbol contiene artefactos de compilación, dependencias instaladas y cargas locales; deben permanecer fuera del código versionado.
- Existe `usuarios.txt` con credenciales locales; se excluye del control de versiones. También se excluyen `.env`, cargas y salidas generadas.
- Se inicializó Git y se creó un punto de recuperación antes de los cambios; `.gitignore` excluye credenciales, secretos, cargas y artefactos.

## Hallazgos de arquitectura y permisos

1. Las aplicaciones ya tienen separación inicial por módulos y la web separa las rutas sociales y administrativas mediante grupos de rutas de Next.js.
2. El modelo de usuario separa `role` (USER, MODERATOR, ADMIN) de `accountType` (STUDENT, TEACHER, PAGE). Esta distinción se conservará y se hará explícita en documentación y políticas.
3. En publicaciones, lectura del muro y detalle ocurre antes del guard de escritura `USER`: moderadores y administradores autenticados pueden consultar contenido, mientras las acciones sociales quedan restringidas. Esto coincide parcialmente con el requisito de moderación de solo lectura.
4. Hay restricciones por rol repetidas dentro de rutas y servicios. Deben centralizarse como capacidades comprobables en servidor y aplicarse por operación y contexto, siguiendo el patrón de Moodle.
5. El backend y la base de datos exponen nombres de campos en inglés (`role`, `accountType`, `posts`, `users`, etc.). Traducirlos en bloque rompería API y datos; cualquier migración se hará con compatibilidad temporal y un plan de vuelta atrás.
6. Las funciones sociales y de administración comparten identidad y datos, pero deben conservar superficies de interfaz distintas: usuario social, moderación de solo lectura con acciones contextuales y herramientas de gestión en el muro de moderación.
7. La auditoría de acciones administrativas y de moderación existe; se debe normalizar qué acciones registra, quién las puede ejecutar y cómo se consultan.

## Arquitectura objetivo

```text
polihub/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/                         # Convenciones obligatorias de Next.js
│   │       ├── modulos/
│   │       │   ├── autenticacion/
│   │       │   ├── publicaciones/
│   │       │   ├── usuarios/
│   │       │   ├── paginas/
│   │       │   ├── comunidades/
│   │       │   ├── chats/
│   │       │   ├── archivos/
│   │       │   ├── notificaciones/
│   │       │   ├── moderacion/
│   │       │   └── administracion/
│   │       ├── componentes_compartidos/
│   │       └── servicios/
│   └── backend/
│       └── src/
│           ├── comun/                       # permisos, validación y errores
│           ├── infraestructura/             # HTTP, MongoDB, almacenamiento y tiempo real
│           └── modulos/                     # dominio y persistencia por funcionalidad
├── configuracion/
│   ├── base_datos/
│   └── firebase/
└── docs/
```

Las carpetas y los archivos propios del producto usan nombres claros en español sin tildes. Se conservan los nombres reservados por Next.js (`page.tsx`, `layout.tsx`) y los nombres de tecnologías y protocolos. Los contratos HTTP y campos existentes de MongoDB se mantienen hasta contar con migraciones compatibles.

## Matriz inicial de capacidades

| Capacidad | Usuario | Moderador | Administrador |
| --- | :---: | :---: | :---: |
| Leer el muro | Sí | Sí, solo lectura | Sí, consulta administrativa |
| Publicar, reaccionar y comentar | Sí | No | No |
| Usar chats y comunidades | Sí | No | No |
| Enviar reportes | Sí | No | No |
| Revisar reportes y aplicar medidas | No | Sí | Sí |
| Consultar cuentas y gestionar datos administrativos | No | No; consulta solo los datos públicos necesarios en el muro/reporte | Sí |
| Crear/restablecer/eliminar cuentas | No | No | Sí |
| Cambiar roles | No | No | Sí, con regla del fundador para otros administradores |
| Verificar páginas | No | No | Sí |
| Consultar auditoría | No | No | Sí |

La matriz ya está centralizada en `apps/backend/src/comun/permisos.ts` y se está adoptando en las rutas existentes. Las comprobaciones de propiedad, estado, baneo y protección del administrador fundador continúan como reglas adicionales por recurso. El moderador no recibe el directorio global de cuentas ni sus correos; revisa la información pública que necesita en las publicaciones y reportes asignados.

## Plan de ejecución y criterios de aceptación

### Etapa 1 — Recuperación e inventario

- Completar el punto de recuperación sin incluir secretos, credenciales ni artefactos generados.
- Registrar módulos, rutas, colecciones y pantallas en esta documentación.
- Identificar funciones activas y dependencias cruzadas antes de mover archivos.

**Estado:** completada. El punto inicial de recuperación es `c5595db`; los cambios posteriores se guardaron en commits separados.

**Aceptación:** existe una versión recuperable del estado previo y el inventario puede servir para revisar cada cambio.

### Etapa 2 — Permisos y límites de roles

- Definir capacidades de servidor: leer muro, publicar, reaccionar, comentar, gestionar páginas, resolver reportes, moderar cuentas, gestionar roles y consultar auditoría.
- Separar las capacidades por rol y contexto; no inferir permisos solo por ocultar botones.
- Usuario: perfil social y acciones permitidas.
- Moderador: lectura del contenido necesario, revisión de reportes y acciones contextuales de moderación; sin perfil público ni acciones sociales.
- Administrador: interfaz compartida con moderación y menús exclusivos para cuentas, roles, contraseñas, baneos, verificación de páginas y auditoría; sin perfil social.
- Preservar la regla del administrador fundador y evitar que pueda eliminarse o quitarse sus propios privilegios.

**Estado:** matriz de capacidades creada y aplicada a las rutas existentes de publicaciones, cuentas, chats, comunidades, páginas, reportes y administración. La interfaz social y la administrativa consultan una matriz visual paralela. Se quitó al moderador el acceso al directorio global de cuentas, conservando la consulta de datos públicos dentro del muro y los reportes.

**Aceptación:** cada endpoint sensible exige capacidad en el backend y la interfaz muestra solo las acciones disponibles para la sesión.

### Etapa 3 — Módulos y contratos

- Alinear estructura web y backend por funcionalidad y documentar dependencias permitidas.
- Asegurar que rutas/controladores coordinen HTTP, servicios contengan reglas del dominio y repositorios/colecciones gestionen MongoDB.
- Reducir consultas MongoDB directas dispersas en rutas sin realizar una migración masiva.
- Normalizar errores, validaciones, paginación, filtros, nombres visibles en español y registros de auditoría.

**Estado:** encabezado, navegación y compositor de publicaciones viven en vistas separadas; las respuestas HTTP se normalizan en adaptadores del módulo de inicio. Moderación, páginas y comunidades están divididos en rutas, controladores, servicios y repositorios; Archivos está dividido en rutas, controlador, servicio y adaptador de almacenamiento local. Administración todavía concentra HTTP, reglas y acceso a MongoDB en un archivo de rutas; la pantalla social central también requiere más descomposición. Los contratos HTTP se mantienen.

**Siguiente trabajo:** dividir Administración en rutas, controladores, servicios y repositorio, empezando por resumen/auditoría y continuando con gestión de cuentas; después extraer los controladores de estado de la pantalla social.

**Aceptación:** cada funcionalidad tiene un límite reconocible, las rutas existentes conservan su contrato y las pruebas de tipo pasan después de cada extracción.

### Etapa 4 — Modelo de datos y migraciones

- Documentar colecciones, índices, relaciones y reglas de borrado lógico.
- Revisar usuarios, publicaciones, comentarios, páginas, comunidades, chats, mensajes, notificaciones, reportes y auditoría.
- Crear migraciones reversibles cuando se cambien nombres o estructura; respaldar y validar conteos antes y después.
- Conservar el controlador oficial de MongoDB; Mongoose no se introduce sin una decisión de arquitectura justificada.

**Estado:** el documento de colecciones y componentes refleja el controlador nativo de MongoDB y señala la discrepancia pendiente del validador histórico de `users.role`. No se han renombrado colecciones ni campos.

**Aceptación:** los cambios de datos tienen pasos de aplicación y reversión, y no borran información existente.

### Etapa 5 — Producto social, moderación y administración

- Cerrar flujos de autenticación y cambio/recuperación de contraseña.
- Revisar muro, publicaciones y archivos, comentarios, reacciones, páginas verificadas, comunidades, chats y notificaciones.
- Organizar reportes por estado, asignación, motivo, evidencia y decisión; notificar a moderadores.
- Registrar acciones de moderación y administración con actor, objetivo, motivo, duración y fecha.
- Diseñar la revisión o apelación de decisiones para que el usuario reciba el motivo y el estado de su reporte.

**Aceptación:** los flujos principales son consistentes de extremo a extremo y no dependen solo de datos de ejemplo.

### Etapa 6 — Interfaz, accesibilidad y despliegue

- Mantener interfaz social y administrativa separadas, y proporcionar a moderación la vista de lectura con menú contextual.
- Revisar adaptación móvil, teclado, foco, contraste, etiquetas y mensajes en español con WCAG 2.2 como referencia.
- En desarrollo conservar web `3000`, API `3001` y MongoDB configurables; en producción usar un origen público y proxy `/api` cuando corresponda.
- Definir almacenamiento durable para archivos, política de secretos, copias de seguridad, registros y monitoreo antes de producción.

**Aceptación:** la aplicación se inicia siguiendo una guía única, no depende de archivos temporales locales y expone errores operativos comprensibles.

## Referentes aplicados

- **Moodle:** roles y capacidades evaluadas de forma explícita según acción y contexto; arquitectura extensible por componentes.
- **Facebook/Meta:** patrones de muro, perfiles y páginas, controles sociales, reportes y herramientas de moderación con trazabilidad.
- **W3C WCAG 2.2:** accesibilidad de navegación, foco, contraste, formularios y componentes interactivos.

Estos referentes guían decisiones funcionales. No implican copiar código, marca, diseño visual ni políticas legales de esos productos.
