import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { hashearContrasena } from '../comun/credenciales';
import { RolUsuario, Usuario } from '../modulos/usuarios/usuario.modelo';

type UsuarioMigracion = Omit<Usuario, 'role'> & { role: RolUsuario | 'STUDENT' | 'TEACHER' };

async function iniciar(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta configurar MONGODB_URI en backend/.env.');
  const cliente = new MongoClient(uri);

  try {
    await cliente.connect();
    const db = cliente.db(process.env.MONGODB_BASE_DATOS ?? 'polihub');
    const usuarios = db.collection<UsuarioMigracion>('users');

    for (const usuario of await usuarios.find({ role: { $in: ['STUDENT', 'TEACHER'] } }).toArray()) {
      const tipoCuenta = usuario.role === 'TEACHER' ? 'TEACHER' : 'STUDENT';
      await usuarios.updateOne(
        { _id: usuario._id },
        { $set: { role: 'USER', accountType: tipoCuenta, updatedAt: new Date() } }
      );
    }
    await usuarios.updateMany(
      { accountType: { $exists: false } },
      { $set: { accountType: 'STUDENT' } }
    );

    const adminExiste = await usuarios.findOne({ role: 'ADMIN', status: 'ACTIVE' });
    const cuentas = [
      {
        username: 'admin', email: 'admin@polihub.local', displayName: 'Administrador Poli Social Network',
        role: 'ADMIN' as const, accountType: 'STUDENT' as const, password: adminExiste ? null : randomBytes(18).toString('base64url'),
      },
      {
        username: 'moderador', email: 'moderador@polihub.local', displayName: 'Moderador Poli Social Network',
        role: 'MODERATOR' as const, accountType: 'STUDENT' as const, password: 'moderador',
      },
      {
        username: 'estudiante', email: 'estudiante@polihub.local', displayName: 'Estudiante de prueba',
        role: 'USER' as const, accountType: 'STUDENT' as const, password: 'estudiante',
      },
      {
        username: 'profesor', email: 'profesor@polihub.local', displayName: 'Profesor de prueba',
        role: 'USER' as const, accountType: 'TEACHER' as const, password: 'profesor',
      },
      {
        username: 'bienestar', email: 'bienestar@polihub.local', displayName: 'Bienestar Universitario',
        role: 'USER' as const, accountType: 'PAGE' as const, password: 'bienestar',
      },
    ];

    for (const cuenta of cuentas) {
      const existente = await usuarios.findOne({ username: cuenta.username });
      if (existente) continue;
      if (!cuenta.password) continue;

      const ahora = new Date();
      const usuario: Usuario = {
        _id: `local_${cuenta.username}`,
        email: cuenta.email,
        emailVerified: false,
        username: cuenta.username,
        displayName: cuenta.displayName,
        avatarUrl: null,
        bio: null,
        campus: 'MEDELLIN',
        faculty: null,
        program: cuenta.accountType === 'PAGE' ? 'Cuenta institucional' : 'Cuenta de prueba',
        semester: null,
        role: cuenta.role,
        accountType: cuenta.accountType,
        passwordHash: await hashearContrasena(cuenta.password),
        localAuth: true,
        mustChangePassword: true,
        isVerifiedPoli: cuenta.accountType === 'PAGE',
        followersCount: 0,
        followingCount: 0,
        fcmTokens: [],
        notificationPrefs: { push: true, follows: true, likes: true, comments: true, mentions: true },
        status: 'ACTIVE',
        termsAcceptedAt: { version: '1.0', at: ahora },
        createdAt: ahora,
        updatedAt: ahora,
      };
      await usuarios.insertOne(usuario);

      if (cuenta.role === 'ADMIN') {
        console.log(`Cuenta inicial de administración: ${cuenta.username}`);
        console.log(`Contraseña temporal: ${cuenta.password}`);
        console.log('Cambia esta contraseña al iniciar sesión.');
      } else {
        console.log(`Cuenta inicial ${cuenta.username}; contraseña temporal igual al usuario; requiere cambio al entrar.`);
      }
    }

    // Vincula la cuenta institucional semilla con su página social verificada.
    const bienestar = await usuarios.findOne({ username: 'bienestar' });
    if (bienestar) {
      const paginas = db.collection('pages');
      const nombre = bienestar.displayName;
      const nombreNormalizado = nombre.toLocaleLowerCase('es');
      const pagina = await paginas.findOne({ nombreNormalizado });
      const ahora = new Date();
      const datosPagina = {
        nombre,
        nombreNormalizado,
        descripcion: 'Página institucional de Bienestar Universitario',
        categoria: 'Servicio institucional',
        propietarioId: bienestar._id,
        propietarioRol: 'ADMIN',
        propietarioSnapshot: {
          username: bienestar.username,
          displayName: bienestar.displayName,
          avatarUrl: bienestar.avatarUrl ?? null,
        },
        isVerified: true,
        verificationStatus: 'VERIFIED',
        verifiedBy: 'local_admin',
        verifiedAt: pagina?.verifiedAt ?? ahora,
      };
      if (!pagina) {
        await paginas.insertOne({
          ...datosPagina,
          avatarUrl: null,
          portadaUrl: null,
          seguidores: 0,
          createdAt: ahora,
        });
      }

    }

    console.log('Cuentas iniciales listas.');
  } finally {
    await cliente.close();
  }
}

iniciar().catch((error: unknown) => {
  console.error('No se pudieron inicializar las cuentas:', error);
  process.exitCode = 1;
});
