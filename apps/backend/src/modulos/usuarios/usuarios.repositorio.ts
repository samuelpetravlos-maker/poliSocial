import { ErrorHttp } from '../../comun/errores';
import { PaginaColeccion } from '../paginas/colecciones';
import { Collection, Db, Document, Filter, ObjectId } from 'mongodb';
import { escaparExpresionRegular } from '../../comun/validacion';
import { Sede, SnapshotAutor, Usuario, crearSnapshotAutor } from './usuario.modelo';

interface DocumentoCatalogo extends Document { _id: string; name?: string; status?: string; campuses?: string[]; semesters?: number; baseType?: string; }

export interface FiltroUsuarios {
  busqueda?: string;
  campus?: Sede;
  program?: string;
  limite: number;
}

export class UsuariosRepositorio {
  private readonly usuarios: Collection<Usuario>;

  constructor(private readonly baseDeDatos: Db) {
    this.usuarios = baseDeDatos.collection<Usuario>('users');
  }

  buscarPorIdentificador(id: string): Promise<Usuario | null> {
    return this.usuarios.findOne({ _id: id });
  }

  buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.usuarios.findOne({ email: email.toLowerCase() });
  }

  buscarPorUsername(username: string): Promise<Usuario | null> {
    return this.usuarios.findOne({ username: username.toLowerCase() });
  }

  async validarDatosInstitucionales(sede: string, programa: string, tipoPerfilId: string, tipoCuenta: string) {
    const sedes = this.baseDeDatos.collection<DocumentoCatalogo>('campuses');
    const programas = this.baseDeDatos.collection<DocumentoCatalogo>('programs');
    const perfiles = this.baseDeDatos.collection<DocumentoCatalogo>('accountTypes');
    const [cantidadSedes, cantidadProgramas, cantidadPerfiles] = await Promise.all([
      sedes.countDocuments(), programas.countDocuments(), perfiles.countDocuments(),
    ]);
    const [sedeValida, programaElegido, perfil] = await Promise.all([
      cantidadSedes === 0 ? Promise.resolve(['URABA', 'MEDELLIN', 'RIONEGRO'].includes(sede) ? { name: sede } : null) : sedes.findOne({ _id: sede, status: { $ne: 'INACTIVE' } }),
      cantidadProgramas === 0 ? Promise.resolve({ semesters: 10 }) : programas.findOne({ name: programa, campuses: sede, status: { $ne: 'INACTIVE' } }),
      cantidadPerfiles === 0 ? Promise.resolve({ baseType: tipoCuenta, name: tipoCuenta }) : perfiles.findOne({ _id: tipoPerfilId, status: { $ne: 'INACTIVE' } }),
    ]);
    return { sedeValida, programa: programaElegido, perfil };
  }

  async crear(usuario: Usuario): Promise<Usuario> {
    await this.usuarios.insertOne(usuario);
    return usuario;
  }

  async limiteSemestres(usuario: Usuario) {
    const programa = await this.baseDeDatos.collection<DocumentoCatalogo>('programs').findOne({ name: usuario.program, campuses: usuario.campus });
    return programa?.semesters ?? 10;
  }

  async actualizarDatosDePagina(usuario: Usuario, cambios: Partial<Usuario>) {
    if (!usuario.paginaId) return;
    const paginas = this.baseDeDatos.collection<PaginaColeccion>('pages');
    const id = new ObjectId(usuario.paginaId);
    const actualizacion: Partial<PaginaColeccion> = {};
    if (cambios.displayName !== undefined) {
      actualizacion.nombre = cambios.displayName;
      actualizacion.nombreNormalizado = cambios.displayName.toLocaleLowerCase('es');
      if (await paginas.findOne({ nombreNormalizado: actualizacion.nombreNormalizado, _id: { $ne: id } })) {
        throw new ErrorHttp(409, 'Ya existe una página con ese nombre.');
      }
    }
    if (cambios.bio !== undefined) actualizacion.descripcion = cambios.bio ?? '';
    if (cambios.avatarUrl !== undefined) actualizacion.avatarUrl = cambios.avatarUrl;
    if (Object.keys(actualizacion).length) await paginas.updateOne({ _id: id }, { $set: actualizacion });
  }

  actualizar(id: string, cambios: Partial<Usuario>): Promise<Usuario | null> {
    return this.usuarios.findOneAndUpdate(
      { _id: id },
      { $set: { ...cambios, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  buscar(filtro: FiltroUsuarios): Promise<Usuario[]> {
    const consulta: Filter<Usuario> = { status: 'ACTIVE', role: 'USER' };

    if (filtro.campus) consulta.campus = filtro.campus;
    if (filtro.program) consulta.program = filtro.program;

    if (filtro.busqueda) {
      const patron = new RegExp(escaparExpresionRegular(filtro.busqueda), 'i');
      consulta.$or = [
        { displayName: patron },
        { username: patron },
        { program: patron },
      ];
    }

    return this.usuarios
      .find(consulta)
      .sort({ followersCount: -1, createdAt: -1 })
      .limit(filtro.limite)
      .toArray();
  }

  sugerencias(usuario: Usuario, limite = 5): Promise<Usuario[]> {
    return this.usuarios
      .find({
        status: 'ACTIVE',
        role: 'USER',
        _id: { $ne: usuario._id },
        campus: usuario.campus,
      })
      .sort({ program: 1, followersCount: -1 })
      .limit(limite)
      .toArray();
  }

  listarPorIds(ids: string[]): Promise<Usuario[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.usuarios.find({ _id: { $in: ids }, status: 'ACTIVE', role: 'USER' }).toArray();
  }

  async propagarSnapshot(usuario: Usuario): Promise<void> {
    const snapshot: SnapshotAutor = crearSnapshotAutor(usuario);
    const infoParticipante = {
      displayName: usuario.displayName,
      avatarUrl: usuario.avatarUrl ?? null,
      program: usuario.program,
    };

    await Promise.all([
      this.baseDeDatos
        .collection('posts')
        .updateMany(
          usuario.accountType === 'PAGE' ? { authorId: usuario._id } : { authorId: usuario._id, pageId: null },
          { $set: { authorSnapshot: snapshot } }
        ),
      this.baseDeDatos
        .collection('comments')
        .updateMany({ authorId: usuario._id }, { $set: { authorSnapshot: snapshot } }),
      this.baseDeDatos.collection('chats').updateMany(
        { participantIds: usuario._id },
        { $set: { [`participantsInfo.${usuario._id}`]: infoParticipante } }
      ),
    ]);
  }
}
