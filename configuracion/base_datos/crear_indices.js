// Índices de Poli Social Network según el documento Base de Datos NoSQL.
// Uso: mongosh "mongodb+srv://..." configuracion/base_datos/crear_indices.js

// ---- users ----
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ campus: 1, program: 1 });
db.users.createIndex({ campus: 1, followersCount: -1 });
db.users.createIndex(
  { displayName: "text", username: "text" },
  { default_language: "spanish", name: "users_text" }
);

// ---- follows ----
db.follows.createIndex({ followerId: 1, createdAt: -1 });
db.follows.createIndex({ followingId: 1, createdAt: -1 });

// ---- posts ----
db.posts.createIndex({ status: 1, createdAt: -1, _id: -1 });
db.posts.createIndex({ status: 1, campus: 1, createdAt: -1, _id: -1 });
db.posts.createIndex({ status: 1, hubChannel: 1, createdAt: -1, _id: -1 });
db.posts.createIndex(
  { campus: 1, isPinned: 1, createdAt: -1 },
  { partialFilterExpression: { isPinned: true } }
);
db.posts.createIndex({ authorId: 1, status: 1, createdAt: -1, _id: -1 });
db.posts.createIndex(
  { title: "text", content: "text", tags: "text" },
  { default_language: "spanish", name: "posts_text" }
);

// ---- reactions ----
db.reactions.createIndex({ postId: 1, userId: 1 }, { unique: true });
db.reactions.createIndex({ userId: 1, createdAt: -1 });

// ---- páginas sociales ----
db.pages.createIndex({ nombreNormalizado: 1 }, { unique: true });
db.pages.createIndex({ propietarioId: 1, createdAt: -1 });
db.pageFollows.createIndex({ pageId: 1, userId: 1 }, { unique: true });
db.pageFollows.createIndex({ userId: 1, createdAt: -1 });

// ---- comunidades ----
db.getCollection('estados.files').createIndex({ 'metadata.retirado': 1, uploadDate: -1, 'metadata.vence': 1 });

db.communities.createIndex({ createdAt: -1 });
db.communities.createIndex({ miembros: 1, updatedAt: -1 });
db.communities.createIndex({ creadorId: 1, createdAt: -1 });

// ---- comments ----
db.comments.createIndex({ postId: 1, status: 1, isAcceptedAnswer: -1, createdAt: 1 });
db.comments.createIndex({ authorId: 1, createdAt: -1 });

// ---- chats ----
db.chats.createIndex({ participantIds: 1, updatedAt: -1 });
db.chats.createIndex(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { type: "DIRECT" } }
);

// ---- messages ----
db.messages.createIndex({ chatId: 1, createdAt: -1, _id: -1 });
db.messages.createIndex(
  { chatId: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: "string" } } }
);

// ---- notifications ----
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, isRead: 1 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// ---- reports ----
db.reports.createIndex({ status: 1, createdAt: -1 });
const indiceReportePrevio = db.reports.getIndexes().find((indice) => indice.name === "reporterId_1_targetType_1_targetId_1");
if (indiceReportePrevio) db.reports.dropIndex(indiceReportePrevio.name);
db.reports.createIndex(
  { reporterId: 1, targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["PENDING", "REVIEWING"] } } }
);

// ---- blocks ----
db.blocks.createIndex({ blockerId: 1 });
db.blocks.createIndex({ blockedId: 1 });

// ---- auditLogs ----
db.auditLogs.createIndex({ createdAt: -1 });
db.auditLogs.createIndex({ actorId: 1, createdAt: -1 });

// ---- catálogo institucional ----
db.campuses.createIndex({ status: 1, name: 1 });
db.programs.createIndex({ faculty: 1, name: 1 });
db.programs.createIndex({ campuses: 1, status: 1 });
db.accountTypes.createIndex({ status: 1, baseType: 1, name: 1 });
db.pageCategories.createIndex({ status: 1, name: 1 });
db.programs.createIndex(
  { name: "text", faculty: "text" },
  { default_language: "spanish", name: "programs_text" }
);

print("Índices de Poli Social Network creados correctamente.");

db.votosEncuesta.createIndex({ publicacionId: 1, opcion: 1 });
db.publicacionesGuardadas.createIndex({ usuarioId: 1, activa: 1, fecha: -1 });
