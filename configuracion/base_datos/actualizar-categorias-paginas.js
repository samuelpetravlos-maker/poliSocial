// Conserva referencias históricas y la decisión posterior del administrador.
db.pageCategories.updateOne({ _id: 'bienestar_universitario', builtin: true, migradaAServicio: { $ne: true } },
  { $set: { status: 'INACTIVE', migradaAServicio: true } });
db.pages.updateMany({ categoria: 'Bienestar universitario' }, { $set: { categoria: 'Servicio institucional' } });
db.pages.updateOne({ propietarioId: 'local_bienestar', categoria: 'Institucional' }, { $set: { categoria: 'Servicio institucional' } });
db.pages.updateMany({ isVerified: false, verificationStatus: 'PENDING', solicitudVerificacion: { $exists: false } }, { $set: { verificationStatus: 'UNREQUESTED' } });
