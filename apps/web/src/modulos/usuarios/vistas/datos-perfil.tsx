'use client';

import { useState, type FormEvent } from 'react';
import { Avatar, InsigniaVerificado } from '@/componentes_compartidos/comunes/avatar';
import { nombreDeSede } from '@/datos/modelos-sociales';
import { useAuth } from '@/modulos/autenticacion/controladores/contexto';
import { obtenerApiUrl, subirArchivoApi } from '@/modulos/archivos/servicios/servicio-api';
import type { Usuario } from '@/servicios/api-cliente';

interface Propiedades {
  usuario: Usuario;
  token: string;
  cantidad: number;
  seguidores: number;
  portada?: string | null;
  alActualizar: () => Promise<void>;
}

export function DatosPerfil({ usuario, token, cantidad, seguidores, portada, alActualizar }: Propiedades) {
  const { actualizarPerfil, limpiarError, error } = useAuth();
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const esPagina = usuario.accountType === 'PAGE';
  const etiqueta = usuario.accountLabel || (esPagina ? 'Página' : usuario.accountType === 'TEACHER' ? 'Profesor' : 'Estudiante');

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setOcupado(true); setMensaje(''); limpiarError();
    try {
      const cambios = {
        displayName: String(datos.get('nombre')).trim(), bio: String(datos.get('bio')).trim(),
        ...(!esPagina && datos.get('semestre') ? { semester: Number(datos.get('semestre')) } : {}),
        links: { github: String(datos.get('github')).trim() || null, linkedin: String(datos.get('linkedin')).trim() || null },
      };
      if (!await actualizarPerfil(cambios)) return;
      setEditando(false);
      setMensaje('Datos actualizados.');
      if (esPagina) await alActualizar();
    } catch (err) { setMensaje(err instanceof Error ? err.message : 'No se pudieron actualizar los datos.'); }
    finally { setOcupado(false); }
  }
  async function cambiarFoto(archivo?: File | null) {
    if (archivo === undefined) return;
    setOcupado(true); setMensaje(''); limpiarError();
    try {
      const subida = archivo ? await subirArchivoApi(archivo, token) : null;
      if (subida && !subida.mime.startsWith('image/')) throw new Error('Elige una imagen para el perfil.');
      if (await actualizarPerfil({ avatarUrl: subida ? new URL(subida.url, obtenerApiUrl()).href : null })) {
        if (esPagina) await alActualizar();
        setMensaje('Foto actualizada.');
      }
    } catch (err) { setMensaje(err instanceof Error ? err.message : 'No se pudo actualizar la foto.'); }
    finally { setOcupado(false); }
  }
  return <section className="tarjeta perfil-portada">
    <div className="portada-degradado" style={portada ? { backgroundImage: `url(${portada})`, backgroundSize: 'cover' } : undefined} />
    <div className="perfil-cabecera">
      <Avatar nombre={usuario.displayName} color="#1b5e20" tamano={92} anillo avatarUrl={usuario.avatarUrl} />
      <div className="perfil-acciones">
        <label className="boton-secundario">Cambiar foto<input type="file" accept="image/*" hidden disabled={ocupado} onChange={e => void cambiarFoto(e.target.files?.[0])} /></label>
        {usuario.avatarUrl && <button className="boton-secundario" disabled={ocupado} onClick={() => void cambiarFoto(null)}>Quitar foto</button>}
        {!editando && <button className="boton-secundario" onClick={() => { limpiarError(); setEditando(true); }}>Actualizar datos</button>}
      </div>
    </div>
    <div className="perfil-datos">
      {(mensaje || error) && <p role="status">{mensaje || error}</p>}
      {editando ? <form className="perfil-formulario" onSubmit={guardar}>
        <label>{esPagina ? 'Nombre público' : 'Nombre completo'}<input name="nombre" required minLength={esPagina ? 3 : 2} maxLength={80} defaultValue={usuario.displayName} /></label>
        <label>Biografía<textarea name="bio" rows={3} maxLength={200} defaultValue={usuario.bio ?? ''} /></label>
        {!esPagina && <label>Semestre<input name="semestre" type="number" min={1} max={20} defaultValue={usuario.semester ?? ''} /></label>}
        <label>Perfil en GitHub<input type="url" name="github" maxLength={300} defaultValue={usuario.links?.github ?? ''} /></label>
        <label>Perfil en LinkedIn<input type="url" name="linkedin" maxLength={300} defaultValue={usuario.links?.linkedin ?? ''} /></label>
        <button className="boton-primario" disabled={ocupado}>Guardar cambios</button>
        <button type="button" className="boton-secundario" disabled={ocupado} onClick={() => setEditando(false)}>Cancelar</button>
      </form> : <>
        <div className="perfil-nombre"><h2>{usuario.displayName}</h2>{usuario.isVerifiedPoli && <InsigniaVerificado tamano={20} />}<span className="badge-rol">{etiqueta}</span></div>
        <p>@{usuario.username}</p>{usuario.bio && <p>{usuario.bio}</p>}
        <div className="perfil-meta"><span>{usuario.campusLabel ?? nombreDeSede(usuario.campus)}</span><span>{usuario.program}</span>
          {!esPagina && usuario.semester && <span>Semestre {usuario.semester}</span>}</div>
        {usuario.links && <div className="perfil-enlaces">{usuario.links.github && <span>{usuario.links.github}</span>}{usuario.links.linkedin && <span>{usuario.links.linkedin}</span>}</div>}
      </>}
    </div>
    <div className="perfil-estadisticas">
      <div><strong>{cantidad}</strong><span>Publicaciones recientes</span></div>
      <div><strong>{seguidores}</strong><span>Seguidores</span></div>
      <div><strong>{usuario.followingCount}</strong><span>Siguiendo</span></div>
    </div>
  </section>;
}
