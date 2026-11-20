// Validadores $jsonSchema de Poli Social Network.
// Uso: mongosh "mongodb+srv://..." configuracion/base_datos/crear_validadores.js

function aplicarValidador(nombre, validador) {
  const existe = db.getCollectionNames().includes(nombre);
  const opciones = {
    validator: validador,
    validationLevel: "moderate",
    validationAction: "error",
  };

  if (existe) {
    db.runCommand({ collMod: nombre, ...opciones });
  } else {
    db.createCollection(nombre, opciones);
  }
}

aplicarValidador("users", {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "_id", "email", "emailVerified", "username", "displayName", "campus",
      "program", "role", "isVerifiedPoli", "followersCount", "followingCount",
      "status", "termsAcceptedAt", "createdAt", "updatedAt",
    ],
    properties: {
      _id: { bsonType: "string" },
      email: { bsonType: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
      emailVerified: { bsonType: "bool" },
      username: { bsonType: "string", pattern: "^[a-z0-9_.]{3,30}$" },
      displayName: { bsonType: "string", minLength: 2, maxLength: 80 },
      avatarUrl: { bsonType: ["string", "null"] },
      bio: { bsonType: ["string", "null"], maxLength: 200 },
      campus: { bsonType: "string", minLength: 2, maxLength: 60 },
      campusLabel: { bsonType: "string", maxLength: 100 },
      faculty: { bsonType: ["string", "null"] },
      program: { bsonType: "string", minLength: 2, maxLength: 120 },
      semester: { bsonType: ["number", "null"], minimum: 1, maximum: 20 },
      links: { bsonType: ["object", "null"] },
      role: { enum: ["USER", "STUDENT", "TEACHER", "MODERATOR", "ADMIN"] },
      accountType: { enum: ["STUDENT", "TEACHER", "PAGE"] },
      accountLabel: { bsonType: "string", maxLength: 80 },
      accountProfileId: { bsonType: "string", maxLength: 48 },
      passwordHash: { bsonType: "string" },
      localAuth: { bsonType: "bool" },
      mustChangePassword: { bsonType: "bool" },
      sessionVersion: { bsonType: "int", minimum: 0 },
      banUntil: { bsonType: ["date", "null"] },
      banReason: { bsonType: ["string", "null"] },
      banDetails: { bsonType: ["string", "null"], maxLength: 500 },
      isVerifiedPoli: { bsonType: "bool" },
      followersCount: { bsonType: "number", minimum: 0 },
      followingCount: { bsonType: "number", minimum: 0 },
      fcmTokens: { bsonType: "array", maxItems: 10, items: { bsonType: "string" } },
      notificationPrefs: { bsonType: ["object", "null"] },
      status: { enum: ["ACTIVE", "SUSPENDED", "DELETED"] },
      termsAcceptedAt: {
        bsonType: "object",
        required: ["version", "at"],
        properties: {
          version: { bsonType: "string" },
          at: { bsonType: "date" },
        },
      },
    },
  },
});

aplicarValidador("follows", {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "followerId", "followingId", "createdAt"],
    properties: {
      _id: { bsonType: "string" },
      followerId: { bsonType: "string" },
      followingId: { bsonType: "string" },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("posts", {
  $and: [
    {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "authorId", "authorSnapshot", "campus", "hubChannel", "content",
          "isPinned", "likesCount", "commentsCount", "status", "isEdited",
          "createdAt", "updatedAt",
        ],
        properties: {
          authorId: { bsonType: "string" },
          formato: { enum: ["NOTICIA", "ENCUESTA", "PREGUNTA", "FORO", "EVENTO"] },
          opcionesEncuesta: { bsonType: "array", minItems: 2, maxItems: 6, uniqueItems: true, items: { bsonType: "string", maxLength: 80 } },
          ubicacion: { bsonType: ["string", "null"], maxLength: 120 },
          fechaEvento: { bsonType: "date" },
          pageId: { bsonType: ["string", "null"] },
          authorSnapshot: {
            bsonType: "object",
            required: ["displayName", "username", "campus", "program", "isVerifiedPoli"],
            properties: {
              displayName: { bsonType: "string" },
              username: { bsonType: "string" },
              avatarUrl: { bsonType: ["string", "null"] },
              campus: { bsonType: "string", minLength: 2, maxLength: 60 },
              program: { bsonType: "string" },
              isVerifiedPoli: { bsonType: "bool" },
              accountType: { enum: ["STUDENT", "TEACHER", "PAGE"] },
            },
          },
          campus: { bsonType: "string", minLength: 2, maxLength: 60 },
          hubChannel: { enum: ["GENERAL", "ACADEMICO", "PROYECTOS", "AVISOS", "MERCADO"] },
          title: { bsonType: ["string", "null"], maxLength: 200 },
          content: { bsonType: "string", maxLength: 5000 },
          mediaUrls: { bsonType: "array", maxItems: 4, items: { bsonType: "string" } },
          tags: { bsonType: "array", maxItems: 5, items: { bsonType: "string" } },
          mentions: { bsonType: "array", items: { bsonType: "string" } },
          marketMeta: {
            bsonType: ["object", "null"],
            properties: {
              price: { bsonType: "number", minimum: 0 },
              currency: { enum: ["COP"] },
              status: { enum: ["AVAILABLE", "SOLD"] },
            },
          },
          isResolved: { bsonType: ["bool", "null"] },
          isPinned: { bsonType: "bool" },
          likesCount: { bsonType: "number", minimum: 0 },
          commentsCount: { bsonType: "number", minimum: 0 },
          status: { enum: ["VISIBLE", "HIDDEN_BY_MOD", "DELETED"] },
          isEdited: { bsonType: "bool" },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
    { $or: [
      { content: { $regex: /\S/ } },
      { hubChannel: "GENERAL", formato: { $in: ["NOTICIA", null] }, "mediaUrls.0": { $exists: true } },
    ] },
    { $or: [{ hubChannel: "GENERAL" }, { title: { $type: "string" } }] },
    { $or: [{ hubChannel: { $ne: "MERCADO" } }, { marketMeta: { $type: "object" } }] },
  ],
});

aplicarValidador("reactions", {
  $jsonSchema: {
    bsonType: "object",
    required: ["postId", "userId", "createdAt"],
    properties: {
      postId: { bsonType: "objectId" },
      userId: { bsonType: "string" },
      type: { enum: ["LIKE", "DISLIKE", "LOVE", "FUN", "AMAZED"] },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("pages", {
  $jsonSchema: {
    bsonType: "object",
    required: ["nombre", "nombreNormalizado", "descripcion", "categoria", "propietarioId", "propietarioRol", "propietarioSnapshot", "seguidores", "isVerified", "verificationStatus", "createdAt"],
    properties: {
      nombre: { bsonType: "string", minLength: 3, maxLength: 80 },
      nombreNormalizado: { bsonType: "string" },
      descripcion: { bsonType: "string", maxLength: 500 },
      categoria: { bsonType: "string", maxLength: 50 },
      propietarioId: { bsonType: "string" },
      propietarioRol: { enum: ["USER", "MODERATOR", "ADMIN"] },
      propietarioSnapshot: { bsonType: "object" },
      avatarUrl: { bsonType: ["string", "null"] },
      portadaUrl: { bsonType: ["string", "null"] },
      seguidores: { bsonType: "int", minimum: 0 },
      isVerified: { bsonType: "bool" },
      verificationStatus: { enum: ["UNREQUESTED", "PENDING", "VERIFIED", "REJECTED"] },
      verifiedBy: { bsonType: ["string", "null"] },
      verifiedAt: { bsonType: ["date", "null"] },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("pageFollows", {
  $jsonSchema: {
    bsonType: "object",
    required: ["pageId", "userId", "createdAt"],
    properties: {
      pageId: { bsonType: "objectId" },
      userId: { bsonType: "string" },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("communities", {
  $jsonSchema: {
    bsonType: "object",
    required: ["nombre", "descripcion", "sede", "categoria", "tipoAcceso", "miembros", "solicitudes", "invitados", "creadorId", "creadorSnapshot", "reglas", "createdAt", "updatedAt"],
    properties: {
      nombre: { bsonType: "string", minLength: 3, maxLength: 80 },
      descripcion: { bsonType: "string", minLength: 3, maxLength: 300 },
      sede: { bsonType: "string" },
      categoria: { enum: ["ACADEMICO", "SEMILLERO", "TECNOLOGIA", "EMPRENDIMIENTO", "DEPORTES", "CULTURA"] },
      tipoAcceso: { enum: ["LIBRE", "APROBACION", "INVITACION"] },
      miembros: { bsonType: "array", items: { bsonType: "string" } },
      solicitudes: { bsonType: "array", items: { bsonType: "string" } },
      invitados: { bsonType: "array", items: { bsonType: "string" } },
      creadorId: { bsonType: "string" },
      creadorSnapshot: { bsonType: "object" },
      reglas: { bsonType: "array", items: { bsonType: "string", maxLength: 200 } },
      chatIdAsociado: { bsonType: ["string", "null"] },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("comments", {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "postId", "authorId", "authorSnapshot", "text", "isAcceptedAnswer",
      "status", "createdAt",
    ],
    properties: {
      postId: { bsonType: "objectId" },
      authorId: { bsonType: "string" },
      authorSnapshot: { bsonType: "object" },
      text: { bsonType: "string", minLength: 1, maxLength: 2000 },
      isAcceptedAnswer: { bsonType: "bool" },
      status: { enum: ["VISIBLE", "HIDDEN_BY_MOD", "DELETED"] },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("chats", {
  $and: [
    {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "type", "participantIds", "participantsInfo", "unreadCounts",
          "createdBy", "updatedAt",
        ],
        properties: {
          type: { enum: ["DIRECT", "GROUP"] },
          directKey: { bsonType: ["string", "null"] },
          groupName: { bsonType: ["string", "null"] },
          groupAvatar: { bsonType: ["string", "null"] },
          participantIds: {
            bsonType: "array",
            minItems: 1,
            items: { bsonType: "string" },
          },
          participantsInfo: { bsonType: "object" },
          lastMessage: { bsonType: ["object", "null"] },
          unreadCounts: { bsonType: "object" },
          createdBy: { bsonType: "string" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
    { $or: [{ comunidadId: { $type: "string" } }, { "participantIds.1": { $exists: true }, "participantIds.100": { $exists: false } }] },
    { $or: [{ type: "GROUP" }, { directKey: { $type: "string" } }] },
    { $or: [{ type: "DIRECT" }, { groupName: { $type: "string" } }] },
  ],
});

aplicarValidador("messages", {
  $and: [
    {
      $jsonSchema: {
        bsonType: "object",
        required: ["chatId", "senderId", "senderName", "readBy", "createdAt"],
        properties: {
          chatId: { bsonType: "objectId" },
          senderId: { bsonType: "string" },
          senderName: { bsonType: "string" },
          text: { bsonType: ["string", "null"], maxLength: 5000 },
          mediaUrl: { bsonType: ["string", "null"] },
          clientMsgId: { bsonType: ["string", "null"] },
          readBy: { bsonType: "array", items: { bsonType: "string" } },
          createdAt: { bsonType: "date" },
        },
      },
    },
    { $or: [{ text: { $type: "string" } }, { mediaUrl: { $type: "string" } }] },
  ],
});

aplicarValidador("notifications", {
  $jsonSchema: {
    bsonType: "object",
    required: ["userId", "type", "actorSnapshot", "isRead", "createdAt"],
    properties: {
      userId: { bsonType: "string" },
      type: {
        enum: ["NEW_FOLLOWER", "LIKE", "COMMENT", "MENTION", "ANSWER_ACCEPTED", "CONTENT_REPORTED", "PAGE_VERIFICATION", "PAGE_DECISION", "CHAT_MESSAGE"],
      },
      actorSnapshot: {
        bsonType: "object",
        required: ["uid", "displayName"],
        properties: {
          uid: { bsonType: "string" },
          displayName: { bsonType: "string" },
          avatarUrl: { bsonType: ["string", "null"] },
        },
      },
      refType: { enum: ["POST", "COMMENT", "USER", "REPORT", "PAGE", "CHAT", null] },
      refId: { bsonType: ["string", "null"] },
      isRead: { bsonType: "bool" },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("reports", {
  $jsonSchema: {
    bsonType: "object",
    required: ["reporterId", "reporterName", "targetType", "targetId", "reason", "status", "createdAt", "updatedAt"],
    properties: {
      reporterId: { bsonType: "string" },
      reporterName: { bsonType: "string" },
      targetType: { enum: ["POST", "COMMENT", "USER", "PAGE", "MESSAGE"] },
      targetId: { bsonType: "string" },
      reason: { enum: ["SPAM", "ACOSO", "CONTENIDO_INAPROPIADO", "FRAUDE", "SUPLANTACION", "OTRO"] },
      details: { bsonType: ["string", "null"], maxLength: 500 },
      status: { enum: ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"] },
      assignedTo: { bsonType: ["string", "null"] },
      resolution: { bsonType: ["string", "null"], maxLength: 500 },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("blocks", {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "blockerId", "blockedId", "createdAt"],
    properties: {
      _id: { bsonType: "string" },
      blockerId: { bsonType: "string" },
      blockedId: { bsonType: "string" },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("auditLogs", {
  $jsonSchema: {
    bsonType: "object",
    required: ["actorId", "actorRole", "action", "targetType", "targetId", "createdAt"],
    properties: {
      actorId: { bsonType: "string" },
      actorRole: { enum: ["MODERATOR", "ADMIN"] },
      action: {
        enum: [
          "HIDE_POST", "HIDE_COMMENT", "PIN_POST", "RESOLVE_REPORT",
        "SUSPEND_USER", "CHANGE_ROLE", "EDIT_CATALOG", "CREATE_USER",
        "BAN_USER", "UNBAN_USER", "RESET_PASSWORD", "DELETE_USER",
        "VERIFY_PAGE", "REJECT_PAGE", "REPORT_REVIEWING", "REPORT_RESOLVED", "REPORT_DISMISSED",
        ],
      },
      targetType: { bsonType: "string" },
      targetId: { bsonType: "string" },
      details: { bsonType: ["object", "null"] },
      createdAt: { bsonType: "date" },
    },
  },
});

aplicarValidador("campuses", {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "name", "city", "status"],
    properties: {
      _id: { bsonType: "string" },
      name: { bsonType: "string" },
      city: { bsonType: "string" },
      status: { enum: ["ACTIVE", "INACTIVE"] },
    },
  },
});

aplicarValidador("programs", {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "name", "faculty", "campuses", "semesters", "status"],
    properties: {
      _id: { bsonType: "string" },
      name: { bsonType: "string" },
      faculty: { bsonType: "string" },
      campuses: { bsonType: "array", items: { bsonType: "string", minLength: 2, maxLength: 60 } },
      semesters: { bsonType: "number", minimum: 1, maximum: 20 },
      status: { enum: ["ACTIVE", "INACTIVE"] },
    },
  },
});

print("Validadores de Poli Social Network aplicados correctamente.");
