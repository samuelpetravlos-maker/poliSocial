// Catálogo institucional de Poli Social Network.
// Uso: mongosh "mongodb+srv://..." configuracion/base_datos/datos_iniciales.js

const sedes = [
  { _id: "MEDELLIN", name: "Sede Central Medellín", city: "Medellín", status: "ACTIVE" },
  { _id: "URABA", name: "Centro Regional Urabá", city: "Apartadó", status: "ACTIVE" },
  { _id: "RIONEGRO", name: "Centro Regional Oriente", city: "Rionegro", status: "ACTIVE" },
];

const programas = [
  {
    _id: "6910",
    name: "Tecnólogo en Desarrollo de Software",
    faculty: "Facultad de Ingeniería",
    campuses: ["MEDELLIN", "URABA", "RIONEGRO"],
    semesters: 6,
    status: "ACTIVE",
  },
  {
    _id: "6901",
    name: "Tecnología en Sistemas",
    faculty: "Facultad de Ingeniería",
    campuses: ["MEDELLIN", "URABA"],
    semesters: 6,
    status: "ACTIVE",
  },
  {
    _id: "1010",
    name: "Ingeniería Informática",
    faculty: "Facultad de Ingeniería",
    campuses: ["MEDELLIN", "RIONEGRO"],
    semesters: 10,
    status: "ACTIVE",
  },
  {
    _id: "2101",
    name: "Tecnología en Gestión Ambiental",
    faculty: "Facultad de Recursos Naturales",
    campuses: ["MEDELLIN", "URABA", "RIONEGRO"],
    semesters: 6,
    status: "ACTIVE",
  },
];

for (const sede of sedes) {
  db.campuses.updateOne({ _id: sede._id }, { $setOnInsert: sede }, { upsert: true });
}

for (const programa of programas) {
  db.programs.updateOne({ _id: programa._id }, { $setOnInsert: programa }, { upsert: true });
}

print("Catálogo institucional de Poli Social Network cargado correctamente.");
