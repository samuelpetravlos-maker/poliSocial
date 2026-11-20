const { MongoClient, BSON } = require('mongodb');

async function importar() {
  if (!process.env.LOTE_CUENTAS_PRUEBA) return;
  const { usuarios, paginas } = BSON.EJSON.parse(process.env.LOTE_CUENTAS_PRUEBA);
  const cliente = await MongoClient.connect(process.env.MONGODB_URI);
  try {
    const base = cliente.db(process.env.MONGODB_BASE_DATOS || 'polihub');
    const usuariosDb = base.collection('users');
    const paginasDb = base.collection('pages');
    for (const u of usuarios) {
      const existe = await usuariosDb.findOne({ $or: [{ _id:u._id },{ username:u.username },{ email:u.email }] });
      if (existe && (existe._id !== u._id || existe.passwordHash !== u.passwordHash)) throw Error('Conflicto en cuenta ' + u.username);
    }
    for (const p of paginas) {
      const existe = await paginasDb.findOne({ $or: [{ _id:p._id },{ nombreNormalizado:p.nombreNormalizado },{ propietarioId:p.propietarioId }] });
      if (existe && (!existe._id.equals(p._id) || existe.propietarioId !== p.propietarioId)) throw Error('Conflicto en página ' + p.nombre);
    }
    for (const p of paginas) await paginasDb.updateOne({ _id:p._id }, { $setOnInsert:p }, { upsert:true });
    for (const u of usuarios) await usuariosDb.updateOne({ _id:u._id }, { $setOnInsert:u }, { upsert:true });
    console.log('Importación completada:', usuarios.length, 'cuentas y', paginas.length, 'páginas.');
  } finally { await cliente.close(); }
}
importar().catch(e => {console.error('Error de importación:',e.codeName || e.name);process.exitCode=1;});
