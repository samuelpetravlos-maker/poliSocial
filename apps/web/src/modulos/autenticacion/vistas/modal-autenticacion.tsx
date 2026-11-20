'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../controladores/contexto';
import {
  PROGRAMAS_CATALOGO,
  SEDES_CATALOGO,
  Sede,
  listarCatalogosPublicosApi,
  type ElementoCatalogoAdministrativo,
} from '../servicios/servicio-api';
import { Icono } from '@/componentes_compartidos/comunes/iconos';

interface ModalAutenticacionProps {
  abierto: boolean;
  onCerrar: () => void;
  modoInicial?: 'login' | 'registro';
  permitirCerrar?: boolean;
}

export function ModalAutenticacion({
  abierto,
  onCerrar,
  modoInicial = 'login',
  permitirCerrar = true,
}: ModalAutenticacionProps) {
  const { iniciarSesion, registrar, cargando, error, limpiarError, backendDisponible } = useAuth();
  const [pestana, setPestana] = useState<'login' | 'registro'>(modoInicial);

  // Formulario Login
  const [identificadorLogin, setIdentificadorLogin] = useState('');
  const [contrasenaLogin, setContrasenaLogin] = useState('');
  const [mostrarPassLogin, setMostrarPassLogin] = useState(false);

  // Formulario Registro
  const [nombreRegistro, setNombreRegistro] = useState('');
  const [emailRegistro, setEmailRegistro] = useState('');
  const [usernameRegistro, setUsernameRegistro] = useState('');
  const [contrasenaRegistro, setContrasenaRegistro] = useState('');
  const [sedeRegistro, setSedeRegistro] = useState<Sede>('URABA');
  const [programaRegistro, setProgramaRegistro] = useState('Tecnólogo en Desarrollo de Software');
  const [semestreRegistro, setSemestreRegistro] = useState<number>(1);
  const [tipoCuentaRegistro, setTipoCuentaRegistro] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [tipoPerfilRegistro, setTipoPerfilRegistro] = useState('STUDENT');
  const [catalogosRegistro, setCatalogosRegistro] = useState<ElementoCatalogoAdministrativo[]>([
    ...Object.values(SEDES_CATALOGO).map((sede) => ({ id: sede.codigo, nombre: sede.nombre, ciudad: sede.ciudad, tipo: 'sede' as const, activo: true })),
    ...PROGRAMAS_CATALOGO.map((programa) => ({ id: programa.id, nombre: programa.nombre, facultad: programa.facultad, sedes: programa.sedes, semestres: programa.semestres, tipo: 'programa' as const, activo: true })),
    { id: 'STUDENT', nombre: 'Estudiante', tipo: 'perfil', tipoBase: 'STUDENT', activo: true },
    { id: 'TEACHER', nombre: 'Profesor', tipo: 'perfil', tipoBase: 'TEACHER', activo: true },
  ]);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);

  // Programas disponibles según la sede seleccionada
  const programasFiltrados = useMemo(() => catalogosRegistro.filter((elemento) => elemento.tipo === 'programa' && elemento.sedes?.includes(sedeRegistro)), [catalogosRegistro, sedeRegistro]);
  const sedesRegistro = useMemo(() => catalogosRegistro.filter((elemento) => elemento.tipo === 'sede'), [catalogosRegistro]);
  const perfilesRegistro = useMemo(() => catalogosRegistro.filter((elemento) => elemento.tipo === 'perfil' && (elemento.tipoBase === 'STUDENT' || elemento.tipoBase === 'TEACHER')), [catalogosRegistro]);
  const programaActual = programasFiltrados.find((programa) => programa.nombre === programaRegistro);

  useEffect(() => {
    if (!abierto) return;
    void listarCatalogosPublicosApi().then((resultado) => {
      setCatalogosRegistro(resultado.catalogos);
      const sedes = resultado.catalogos.filter((elemento) => elemento.tipo === 'sede');
      const sedeSeleccionada = sedes.some((sede) => sede.id === sedeRegistro) ? sedeRegistro : sedes[0]?.id;
      if (sedeSeleccionada) setSedeRegistro(sedeSeleccionada as Sede);
      const programasSede = resultado.catalogos.filter((elemento) => elemento.tipo === 'programa' && elemento.sedes?.includes(sedeSeleccionada ?? ''));
      if (!programasSede.some((programa) => programa.nombre === programaRegistro)) setProgramaRegistro(programasSede[0]?.nombre ?? '');
      const perfiles = resultado.catalogos.filter((elemento) => elemento.tipo === 'perfil' && (elemento.tipoBase === 'STUDENT' || elemento.tipoBase === 'TEACHER'));
      if (perfiles.length && !perfiles.some((perfil) => perfil.id === tipoPerfilRegistro)) {
        setTipoPerfilRegistro(perfiles[0].id);
        setTipoCuentaRegistro(perfiles[0].tipoBase as 'STUDENT' | 'TEACHER');
      }
    }).catch(() => undefined);
  }, [abierto]);

  const esCorreoPoli = emailRegistro.trim().toLowerCase().endsWith('@elpoli.edu.co');

  if (!abierto) return null;

  async function manejarSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    limpiarError();
    const exito = await iniciarSesion(identificadorLogin, contrasenaLogin);
    if (exito) {
      onCerrar();
    }
  }

  async function manejarSubmitRegistro(e: React.FormEvent) {
    e.preventDefault();
    limpiarError();

    const programaSeleccionado = programasFiltrados.find((p) => p.nombre === programaRegistro);

    const exito = await registrar(
      {
        displayName: nombreRegistro.trim(),
        email: emailRegistro.trim().toLowerCase(),
        username: usernameRegistro.trim().toLowerCase(),
        campus: sedeRegistro,
        program: programaRegistro,
        faculty: programaSeleccionado?.facultad || 'Facultad de Ingeniería',
        semester: Number(semestreRegistro),
        accountType: tipoCuentaRegistro,
        tipoPerfilId: tipoPerfilRegistro,
        aceptaTerminos: aceptaTerminos,
        versionTerminos: '1.0',
      },
      contrasenaRegistro
    );

    if (exito) {
      onCerrar();
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-contenedor tarjeta" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del modal */}
        <header className="modal-encabezado">
          <div className="modal-marca">
            <span className="logo-circulo-modal">PJIC</span>
            <div>
              <h3>Poli Social Network</h3>
              <p>Comunidad Universitaria Jaime Isaza Cadavid</p>
            </div>
          </div>
          {permitirCerrar && (
            <button
              type="button"
              className="boton-cerrar-modal"
              onClick={onCerrar}
              aria-label="Cerrar ventana"
            >
              <Icono nombre="cerrar" tamano={20} />
            </button>
          )}
        </header>

        {/* Indicador de conexión con backend */}
        <div className={`alerta-conexion ${backendDisponible ? 'conectado' : 'desconectado'}`}>
          <span className="punto-conexion" />
          {backendDisponible
            ? 'Servicio de acceso disponible'
            : 'Esperando conexión con el servicio de acceso'}
        </div>

        {/* Pestañas de Login / Registro */}
        <div className="tabs-autenticacion">
          <button
            type="button"
            className={`tab-auth ${pestana === 'login' ? 'activa' : ''}`}
            onClick={() => {
              setPestana('login');
              limpiarError();
            }}
          >
            <Icono nombre="candado" tamano={16} />
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`tab-auth ${pestana === 'registro' ? 'activa' : ''}`}
            onClick={() => {
              setPestana('registro');
              limpiarError();
            }}
          >
            <Icono nombre="usuario" tamano={16} />
            Crear Cuenta
          </button>
        </div>

        {/* Mensaje de error general */}
        {error && (
          <div className="mensaje-error-auth">
            <Icono nombre="campana" tamano={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ================= PESTAÑA: LOGIN ================= */}
        {pestana === 'login' && (
          <form onSubmit={manejarSubmitLogin} className="formulario-auth">
            <div className="campo-auth">
              <label htmlFor="login-id">Correo institucional o nombre de usuario</label>
              <div className="input-con-icono">
                <Icono nombre="correo" tamano={18} />
                <input
                  id="login-id"
                  type="text"
                  placeholder="ej. samuel.petro@elpoli.edu.co o samuel_petro"
                  value={identificadorLogin}
                  onChange={(e) => setIdentificadorLogin(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="campo-auth">
              <label htmlFor="login-pass">Contraseña</label>
              <div className="input-con-icono">
                <Icono nombre="candado" tamano={18} />
                <input
                  id="login-pass"
                  type={mostrarPassLogin ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={contrasenaLogin}
                  onChange={(e) => setContrasenaLogin(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="boton-revelar-pass"
                  onClick={() => setMostrarPassLogin(!mostrarPassLogin)}
                >
                  {mostrarPassLogin ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="boton-primario boton-bloque"
              disabled={cargando || !identificadorLogin.trim()}
            >
              {cargando ? 'Verificando...' : 'Entrar a Poli Social Network'}
            </button>

          </form>
        )}

        {/* ================= PESTAÑA: REGISTRO ================= */}
        {pestana === 'registro' && (
          <form onSubmit={manejarSubmitRegistro} className="formulario-auth">
            <div className="campo-auth">
              <label htmlFor="reg-nombre">Nombre completo</label>
              <div className="input-con-icono">
                <Icono nombre="usuario" tamano={18} />
                <input
                  id="reg-nombre"
                  type="text"
                  placeholder="ej. Samuel Petro Ávalos"
                  value={nombreRegistro}
                  onChange={(e) => setNombreRegistro(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
            </div>

            <div className="campo-auth">
              <label htmlFor="reg-email">
                Correo electrónico
                {esCorreoPoli && (
                  <span className="badge-verificado-previo">✨ Insignia Verificado PJIC</span>
                )}
              </label>
              <div className="input-con-icono">
                <Icono nombre="correo" tamano={18} />
                <input
                  id="reg-email"
                  type="email"
                  placeholder="nombre.apellido@elpoli.edu.co"
                  value={emailRegistro}
                  onChange={(e) => setEmailRegistro(e.target.value)}
                  required
                />
              </div>
              <small className="texto-pista">
                Usa tu correo @elpoli.edu.co para recibir automáticamente la insignia oficial del Poli.
              </small>
            </div>

            <div className="grid-dos-campos">
              <div className="campo-auth">
                <label htmlFor="reg-username">Nombre de usuario</label>
                <div className="input-con-icono">
                  <span className="prefijo-arroba">@</span>
                  <input
                    id="reg-username"
                    type="text"
                    placeholder="samuel_petro"
                    value={usernameRegistro}
                    onChange={(e) =>
                      setUsernameRegistro(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '')
                      )
                    }
                    minLength={3}
                    maxLength={30}
                    required
                  />
                </div>
                <small className="texto-pista">3-30 caracteres (minúsculas, números, punto o _)</small>
              </div>

              <div className="campo-auth">
                <label htmlFor="reg-pass">Contraseña</label>
                <div className="input-con-icono">
                  <Icono nombre="candado" tamano={18} />
                  <input
                    id="reg-pass"
                    type="password"
                  placeholder="Mínimo 8 caracteres"
                    value={contrasenaRegistro}
                    onChange={(e) => setContrasenaRegistro(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Sede y Carrera */}
            <div className="campo-auth">
              <label htmlFor="reg-tipo-cuenta">Perfil</label>
              <div className="input-con-icono">
                <Icono nombre="usuario" tamano={18} />
                <select
                  id="reg-tipo-cuenta"
                  value={tipoPerfilRegistro}
                  onChange={(e) => { const perfil = perfilesRegistro.find((elemento) => elemento.id === e.target.value); if (perfil?.tipoBase) { setTipoPerfilRegistro(perfil.id); setTipoCuentaRegistro(perfil.tipoBase as 'STUDENT' | 'TEACHER'); } }}
                >
                  {perfilesRegistro.map((perfil) => <option key={perfil.id} value={perfil.id}>{perfil.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-dos-campos">
              <div className="campo-auth">
                <label htmlFor="reg-sede">Sede del PJIC</label>
                <div className="input-con-icono">
                  <Icono nombre="ubicacion" tamano={18} />
                  <select
                    id="reg-sede"
                    value={sedeRegistro}
                    onChange={(e) => {
                      const nuevaSede = e.target.value as Sede;
                      setSedeRegistro(nuevaSede);
                      // Ajustar programa si no está en la nueva sede
                      const primerProg = catalogosRegistro.find((p) => p.tipo === 'programa' && p.sedes?.includes(nuevaSede));
                      setProgramaRegistro(primerProg?.nombre ?? '');
                      setSemestreRegistro(1);
                    }}
                  >
                    {sedesRegistro.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}{sede.ciudad ? ` (${sede.ciudad})` : ''}</option>)}
                  </select>
                </div>
              </div>

              <div className="campo-auth">
                <label htmlFor="reg-semestre">Semestre actual</label>
                <div className="input-con-icono">
                  <Icono nombre="graduacion" tamano={18} />
                  <select
                    id="reg-semestre"
                    value={semestreRegistro}
                    onChange={(e) => setSemestreRegistro(Number(e.target.value))}
                  >
                    {Array.from({ length: programaActual?.semestres ?? 10 }, (_, i) => i + 1).map((s) => (
                      <option key={s} value={s}>
                        Semestre {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="campo-auth">
              <label htmlFor="reg-programa">Programa Académico</label>
              <div className="input-con-icono">
                <Icono nombre="graduacion" tamano={18} />
                <select
                  id="reg-programa"
                  value={programaRegistro}
                  onChange={(e) => {
                    const programa = programasFiltrados.find((item) => item.nombre === e.target.value);
                    setProgramaRegistro(e.target.value);
                    setSemestreRegistro((actual) => Math.min(actual, programa?.semestres ?? 10));
                  }}
                >
                  {programasFiltrados.map((prog) => (
                    <option key={prog.id} value={prog.nombre}>
                      {prog.nombre} · {prog.facultad} ({prog.semestres} semestres)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Aceptación de términos y Habeas Data */}
            <div className="campo-terminos">
              <label className="checkbox-terminos">
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  required
                />
                <span>
                  Acepto las{' '}
                  <button
                    type="button"
                    className="enlace-terminos"
                    onClick={() => setMostrarTerminos(!mostrarTerminos)}
                  >
                    normas de convivencia y la política de datos (Ley 1581 de 2012)
                  </button>
                  .
                </span>
              </label>

              {mostrarTerminos && (
                <div className="detalle-terminos tarjeta">
                  <strong>Tratamiento de Datos y Convivencia (PJIC)</strong>
                  <p>
                    Tus datos serán tratados exclusivamente para facilitar la interacción académica,
                    foros y mensajería universitaria entre estudiantes y docentes del Politécnico
                    Colombiano Jaime Isaza Cadavid, en cumplimiento de la Ley 1581 de 2012 (Habeas
                    Data). Puedes solicitar la supresión o corrección de tus datos en cualquier
                    momento desde la configuración de tu cuenta.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="boton-primario boton-bloque"
              disabled={
                cargando ||
                !aceptaTerminos ||
                !nombreRegistro.trim() ||
                !emailRegistro.trim() ||
                !usernameRegistro.trim() ||
                contrasenaRegistro.length < 8
              }
            >
              {cargando ? 'Creando perfil en MongoDB...' : 'Crear Mi Cuenta en Poli Social Network'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

