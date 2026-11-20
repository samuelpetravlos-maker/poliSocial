# Módulo de moderación

El módulo acepta reportes de publicaciones, comentarios, cuentas, páginas y mensajes. Al crear un reporte abierto, notifica a los moderadores activos y evita duplicar su notificación.

La revisión permite tomar un caso, marcarlo como resuelto o descartarlo. Las medidas disponibles dependen del objetivo:

- Publicación: ocultarla o eliminarla.
- Comentario: ocultarlo o eliminarlo.
- Cuenta personal: suspenderla durante 30 días, con registro del motivo.
- Página o mensaje: se puede reportar y revisar; todavía falta definir una medida específica para esos objetivos.

La implementación separa rutas HTTP, controladores, reglas de negocio y acceso a MongoDB en `rutas.ts`, `controladores.ts`, `servicios.ts` y `repositorio.ts`. La política de capacidades vive en `apps/backend/src/comun/permisos.ts`; la propiedad del contenido, el estado de la cuenta y las restricciones del administrador fundador se comprueban además en el servicio.

Cada medida aplicada queda en auditoría con actor, objetivo, motivo y detalles. El flujo de apelación y la revisión de archivos adjuntos todavía están pendientes.
