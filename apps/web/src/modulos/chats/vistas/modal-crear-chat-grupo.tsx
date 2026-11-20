'use client';

import { useState } from 'react';
import { Avatar } from '@/componentes_compartidos/comunes/avatar';
import { Icono } from '@/componentes_compartidos/comunes/iconos';

export interface EstudianteDisponible {
  id: string;
  nombre: string;
  usuario: string;
  sede: string;
  programa: string;
  avatarUrl?: string | null;
  color: string;
}

interface ModalCrearChatGrupoProps {
  abierto: boolean;
  onCerrar: () => void;
  onCrear: (datos: {
    nombre: string;
    descripcion: string;
    participantesIds: string[];
  }) => void;
  estudiantes: EstudianteDisponible[];
}

export function ModalCrearChatGrupo({
  abierto,
  onCerrar,
  onCrear,
  estudiantes,
}: ModalCrearChatGrupoProps) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');

  if (!abierto) return null;

  function alternarSeleccion(id: string) {
    if (seleccionados.includes(id)) {
      setSeleccionados(seleccionados.filter((item) => item !== id));
    } else {
      setSeleccionados([...seleccionados, id]);
    }
  }

  const estudiantesFiltrados = estudiantes.filter((est) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      est.nombre.toLowerCase().includes(q) ||
      est.usuario.toLowerCase().includes(q) ||
      est.programa.toLowerCase().includes(q) ||
      est.sede.toLowerCase().includes(q)
    );
  });

  const minimoAlcanzado = seleccionados.length >= 2;

  function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !minimoAlcanzado) return;

    onCrear({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || 'Grupo de estudio colaborativo de Poli Social Network.',
      participantesIds: seleccionados,
    });

    onCerrar();
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-contenedor tarjeta modal-grupo" onClick={(e) => e.stopPropagation()}>
        <header className="modal-encabezado">
          <div className="modal-marca">
            <span className="logo-circulo-modal">
              <Icono nombre="mensajes" tamano={22} />
            </span>
            <div>
              <h3>Nuevo Grupo de Estudio</h3>
              <p>Crea una sala de chat grupal en tiempo real</p>
            </div>
          </div>
          <button
            type="button"
            className="boton-cerrar-modal"
            onClick={onCerrar}
            aria-label="Cerrar ventana"
          >
            <Icono nombre="cerrar" tamano={20} />
          </button>
        </header>

        <form onSubmit={manejarSubmit} className="formulario-auth">
          <div className="campo-auth">
            <label htmlFor="grupo-nombre">Nombre del grupo de estudio</label>
            <div className="input-con-icono">
              <Icono nombre="personas" tamano={18} />
              <input
                id="grupo-nombre"
                type="text"
                placeholder="ej. Arquitectura de Software · Urabá o Proyecto Integrador"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                required
              />
            </div>
          </div>

          <div className="campo-auth">
            <label htmlFor="grupo-desc">Descripción o asignatura (opcional)</label>
            <input
              id="grupo-desc"
              type="text"
              className="input-con-icono-simple"
              placeholder="ej. Coordinación de talleres y entregas parciales"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Seleccionar participantes */}
          <div className="campo-auth">
            <div className="encabezado-seleccion-participantes">
              <label>Seleccionar integrantes ({seleccionados.length} elegidos)</label>
              <span className={`indicador-minimo ${minimoAlcanzado ? 'valido' : 'alerta'}`}>
                {minimoAlcanzado
                  ? '✓ Mínimo cumplido (2+ compañeros)'
                  : 'Se requieren al menos 2 integrantes'}
              </span>
            </div>

            {/* Buscador de compañeros */}
            <div className="buscador-participantes">
              <Icono nombre="buscar" tamano={16} />
              <input
                type="text"
                placeholder="Buscar por nombre, carrera o sede..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="lista-seleccionables">
              {estudiantesFiltrados.map((est) => {
                const marcado = seleccionados.includes(est.id);
                return (
                  <button
                    key={est.id}
                    type="button"
                    className={`item-seleccionable ${marcado ? 'marcado' : ''}`}
                    onClick={() => alternarSeleccion(est.id)}
                  >
                    <Avatar nombre={est.nombre} color={est.color} avatarUrl={est.avatarUrl} tamano={36} />
                    <div className="datos-seleccionable">
                      <strong>{est.nombre}</strong>
                      <small>
                        @{est.usuario} · {est.sede} · {est.programa}
                      </small>
                    </div>
                    <span className="check-box-estudiante">
                      {marcado ? <Icono nombre="check" tamano={14} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="boton-primario boton-bloque"
            disabled={!nombre.trim() || !minimoAlcanzado}
          >
            Crear Grupo de Estudio ({seleccionados.length + 1} integrantes)
          </button>
        </form>
      </div>
    </div>
  );
}

