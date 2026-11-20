'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  CLAVES_ALMACENAMIENTO,
  DatosRegistro,
  ErrorApi,
  Usuario,
  cambiarContrasenaApi,
  iniciarSesionLocalApi,
  registrarCuentaLocalApi,
  verificarSalud,
} from '../servicios/servicio-api';
import { actualizarMiPerfilApi, obtenerMiPerfilApi, registrarUsuarioApi } from '@/modulos/usuarios/servicios/servicio-api';

import { entrarPaginaApi } from '@/servicios/api-cliente';

const CLAVE_PAGINA = 'poli_pagina_activa';
const CLAVE_TITULAR = 'poli_sesion_titular';

function limpiarPaginaActiva() {
  sessionStorage.removeItem(CLAVE_PAGINA);
  sessionStorage.removeItem(CLAVE_TITULAR);
}

interface EstadoAutenticacion {
  alternarPagina: (paginaId: string | null) => Promise<void>;
  usuario: Usuario | null;
  token: string | null;
  cargando: boolean;
  backendDisponible: boolean;
  error: string | null;
  iniciarSesion: (emailOUsuario: string, contrasena?: string) => Promise<boolean>;
  registrar: (datos: DatosRegistro, contrasena?: string) => Promise<boolean>;
  cerrarSesion: () => void;
  cambiarContrasena: (passwordActual: string, passwordNueva: string) => Promise<boolean>;
  limpiarError: () => void;
  actualizarPerfil: (datos: Parameters<typeof actualizarMiPerfilApi>[0]) => Promise<boolean>;
  recargarPerfil: () => Promise<void>;
}

const ContextoAuth = createContext<EstadoAutenticacion | undefined>(undefined);

export function ProveedorAutenticacion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [backendDisponible, setBackendDisponible] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Comprobar salud del backend periódicamente o al montar
  const chequearBackend = useCallback(async () => {
    const salud = await verificarSalud();
    setBackendDisponible(salud);
    return salud;
  }, []);

  // Cargar sesión guardada en localStorage
  useEffect(() => {
    async function inicializarSesion() {
      try {
        await chequearBackend();
        const tokenGuardado = localStorage.getItem(CLAVES_ALMACENAMIENTO.TOKEN);

        if (tokenGuardado) {
          // La sesión solo se restaura después de validar el token y el perfil.
          try {
            let tokenActivo = tokenGuardado;
            const paginaGuardada = sessionStorage.getItem(CLAVE_PAGINA);
            if (paginaGuardada && sessionStorage.getItem(CLAVE_TITULAR) === tokenGuardado) tokenActivo = paginaGuardada;
            let perfilActualizado: Usuario;
            try {
              perfilActualizado = await obtenerMiPerfilApi(tokenActivo);
            } catch (error) {
              if (tokenActivo === tokenGuardado) throw error;
              limpiarPaginaActiva();
              tokenActivo = tokenGuardado;
              perfilActualizado = await obtenerMiPerfilApi(tokenActivo);
            }
            setToken(tokenActivo);
            setUsuario(perfilActualizado);
            localStorage.setItem(CLAVES_ALMACENAMIENTO.USUARIO, JSON.stringify(perfilActualizado));
          } catch {
            limpiarPaginaActiva();
            localStorage.removeItem(CLAVES_ALMACENAMIENTO.TOKEN);
            localStorage.removeItem(CLAVES_ALMACENAMIENTO.USUARIO);
            setToken(null);
            setUsuario(null);
          }
        }
      } catch {
        // Inicialización segura sin romper la UI
      } finally {
        setCargando(false);
      }
    }

    inicializarSesion();
  }, [chequearBackend]);

  const limpiarError = useCallback(() => setError(null), []);

  /**
   * Busca primero una cuenta local administrada por Poli Social Network y, si no existe,
   * permite autenticar cuentas heredadas mediante Firebase cuando está configurado.
   */
  const iniciarSesion = useCallback(
    async (emailOUsuario: string, contrasena?: string): Promise<boolean> => {
      setCargando(true);
      setError(null);

      try {
        const identificador = emailOUsuario.trim();
        if (!identificador) {
          throw new Error('Ingresa tu correo institucional o nombre de usuario.');
        }

        const apiKeyFirebase = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        let tokenParaBackend: string | null = null;
        let perfil: Usuario | null = null;

        try {
          const sesionLocal = await iniciarSesionLocalApi(identificador, contrasena ?? '');
          tokenParaBackend = sesionLocal.token;
          perfil = sesionLocal.usuario;
        } catch (errorLocal) {
          const puedeUsarFirebase = errorLocal instanceof ErrorApi && errorLocal.estado === 404 && apiKeyFirebase && contrasena;
          if (!puedeUsarFirebase) {
            if (errorLocal instanceof ErrorApi && errorLocal.estado === 404 && !apiKeyFirebase) {
              throw new Error('No existe una cuenta local con ese usuario.');
            }
            throw errorLocal;
          }

          // Autenticación con Firebase Identity Toolkit REST API
          const respuesta = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKeyFirebase)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: identificador,
                password: contrasena,
                returnSecureToken: true,
              }),
            }
          );

          const datos = await respuesta.json();
          if (!respuesta.ok) {
            const mensajeError = datos.error?.message || 'Error de autenticación con Firebase';
            if (mensajeError.includes('INVALID_LOGIN_CREDENTIALS') || mensajeError.includes('EMAIL_NOT_FOUND')) {
              throw new Error('Correo o contraseña incorrectos.');
            }
            throw new Error(mensajeError);
          }

          const tokenFirebase = datos.idToken as string;
          tokenParaBackend = tokenFirebase;
          perfil = await obtenerMiPerfilApi(tokenFirebase);
        }

        if (!tokenParaBackend || !perfil) throw new Error('No fue posible validar la sesión.');

        limpiarPaginaActiva();
        setToken(tokenParaBackend);
        setUsuario(perfil);
        localStorage.setItem(CLAVES_ALMACENAMIENTO.TOKEN, tokenParaBackend);
        localStorage.setItem(CLAVES_ALMACENAMIENTO.USUARIO, JSON.stringify(perfil));

        return true;
      } catch (err) {
        const mensaje =
          err instanceof ErrorApi
            ? err.mensaje
            : err instanceof Error
            ? err.message
            : 'Error al iniciar sesión.';
        setError(mensaje);
        return false;
      } finally {
        setCargando(false);
      }
    },
    []
  );

  /**
   * Registro universitario:
   * 1. Crea la cuenta en Firebase si está configurado.
   * 2. Registra el documento en MongoDB mediante `POST /api/usuarios`.
   */
  const registrar = useCallback(
    async (datos: DatosRegistro, contrasena?: string): Promise<boolean> => {
      setCargando(true);
      setError(null);

      try {
        const apiKeyFirebase = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        let tokenParaBackend: string;

        if (apiKeyFirebase && contrasena) {
          // Registro en Firebase Auth
          const resFirebase = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKeyFirebase)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: datos.email,
                password: contrasena,
                returnSecureToken: true,
              }),
            }
          );

          const datosFirebase = await resFirebase.json();
          if (!resFirebase.ok) {
            const msg = datosFirebase.error?.message || 'Error al crear cuenta en Firebase';
            if (msg.includes('EMAIL_EXISTS')) {
              throw new Error('Ese correo institucional ya se encuentra registrado.');
            }
            throw new Error(msg);
          }

          tokenParaBackend = datosFirebase.idToken;
        } else {
          const sesionLocal = await registrarCuentaLocalApi(datos, contrasena ?? '');
          setToken(sesionLocal.token);
          setUsuario(sesionLocal.usuario);
          localStorage.setItem(CLAVES_ALMACENAMIENTO.TOKEN, sesionLocal.token);
          localStorage.setItem(CLAVES_ALMACENAMIENTO.USUARIO, JSON.stringify(sesionLocal.usuario));
          return true;
        }

        // Registrar en MongoDB
        const nuevoUsuario = await registrarUsuarioApi(
          {
            ...datos,
            emailVerified: datos.email.toLowerCase().endsWith('@elpoli.edu.co'),
          },
          tokenParaBackend
        );

        setToken(tokenParaBackend);
        setUsuario(nuevoUsuario);
        localStorage.setItem(CLAVES_ALMACENAMIENTO.TOKEN, tokenParaBackend);
        localStorage.setItem(CLAVES_ALMACENAMIENTO.USUARIO, JSON.stringify(nuevoUsuario));

        return true;
      } catch (err) {
        const mensaje =
          err instanceof ErrorApi
            ? err.mensaje
            : err instanceof Error
            ? err.message
            : 'Error al registrar usuario.';
        setError(mensaje);
        return false;
      } finally {
        setCargando(false);
      }
    },
    []
  );

  const alternarPagina = useCallback(async (paginaId: string | null) => {
    const titular = localStorage.getItem(CLAVES_ALMACENAMIENTO.TOKEN);
    if (!titular) throw new Error('Inicia sesión para cambiar de perfil.');
    if (paginaId) {
      const resultado = await entrarPaginaApi(paginaId, titular);
      sessionStorage.setItem(CLAVE_PAGINA, resultado.token);
      sessionStorage.setItem(CLAVE_TITULAR, titular);
    } else {
      limpiarPaginaActiva();
    }
    window.location.assign('/inicio');
  }, []);

  const cerrarSesion = useCallback(() => {
    limpiarPaginaActiva();
    localStorage.removeItem(CLAVES_ALMACENAMIENTO.TOKEN);
    localStorage.removeItem(CLAVES_ALMACENAMIENTO.USUARIO);
    setToken(null);
    setUsuario(null);
    setError(null);
  }, []);

  const cambiarContrasena = useCallback(
    async (passwordActual: string, passwordNueva: string): Promise<boolean> => {
      if (!token) return false;
      try {
        const resultado = await cambiarContrasenaApi(passwordActual, passwordNueva, token);
        setUsuario(resultado.usuario);
        setToken(resultado.token);
        localStorage.setItem(CLAVES_ALMACENAMIENTO.TOKEN, resultado.token);
        localStorage.setItem(CLAVES_ALMACENAMIENTO.USUARIO, JSON.stringify(resultado.usuario));
        return true;
      } catch (err) {
        const mensaje = err instanceof ErrorApi ? err.mensaje : 'No fue posible cambiar la contraseña.';
        setError(mensaje);
        return false;
      }
    },
    [token]
  );

  const actualizarPerfil = useCallback(
    async (datos: Parameters<typeof actualizarMiPerfilApi>[0]): Promise<boolean> => {
      if (!token) return false;
      try {
        const actualizado = await actualizarMiPerfilApi(datos, token);
        setUsuario(actualizado);
        localStorage.setItem(CLAVES_ALMACENAMIENTO.USUARIO, JSON.stringify(actualizado));
        return true;
      } catch (err) {
        const mensaje = err instanceof ErrorApi ? err.mensaje : 'Error al actualizar perfil.';
        setError(mensaje);
        return false;
      }
    },
    [token]
  );

  const recargarPerfil = useCallback(async () => {
    if (!token) return;
    try {
      const perfil = await obtenerMiPerfilApi(token);
      setUsuario(perfil);
      localStorage.setItem(CLAVES_ALMACENAMIENTO.USUARIO, JSON.stringify(perfil));
    } catch {
      // Ignorar errores transitorios de red
    }
  }, [token]);

  return (
    <ContextoAuth.Provider
      value={{
        usuario,
        token,
        cargando,
        backendDisponible,
        error,
        iniciarSesion,
        registrar,
        cerrarSesion,
        alternarPagina,
        cambiarContrasena,
        limpiarError,
        actualizarPerfil,
        recargarPerfil,
      }}
    >
      {children}
    </ContextoAuth.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(ContextoAuth);
  if (!contexto) {
    throw new Error('useAuth debe ser utilizado dentro de un ProveedorAutenticacion');
  }
  return contexto;
}

