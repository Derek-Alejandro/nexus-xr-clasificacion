export function mostrarCarga(estado, mensaje) {
  const indicador = document.querySelector('#estado-carga');
  indicador.dataset.state = estado;
  indicador.textContent = mensaje;
}

export function mostrarXR(mensaje) {
  document.querySelector('#estado-xr').textContent = mensaje;
}

export function comprobarRecursosPortada() {
  const fallos = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .filter((enlace) => !enlace.sheet)
    .map((enlace) => enlace.href);
  const icono = document.querySelector('.brand img');
  if (icono.naturalWidth === 0) fallos.push(icono.src);
  if (fallos.length === 0) return;

  document.querySelector('#estado-recursos').textContent =
    'Parte del estilo o el icono de la portada no se cargó. Revisa Network y recarga.';
  console.warn('NEXUS XR · Recursos de la portada sin cargar', fallos);
}

export async function comprobarWebXR() {
  if (!window.isSecureContext) {
    return { compatible: false, mensaje: 'WebXR requiere HTTPS en el visor o localhost en la PC.' };
  }

  if (typeof navigator.xr?.isSessionSupported !== 'function') {
    return { compatible: false, mensaje: 'Este navegador no ofrece WebXR. Puedes usar la vista previa.' };
  }

  try {
    const compatible = await navigator.xr.isSessionSupported('immersive-vr');
    const mensaje = compatible
      ? 'Este entorno admite VR inmersiva. La disponibilidad de manos se comprobará al entrar.'
      : 'WebXR está disponible, pero este entorno no admite sesiones de VR inmersiva.';
    return { compatible, mensaje };
  } catch (error) {
    console.error('NEXUS XR · Error al consultar immersive-vr', error);
    return { compatible: false, mensaje: 'No se pudo consultar la compatibilidad con WebXR. Revisa los permisos y la consola.' };
  }
}

export function prepararPantallaCompleta() {
  const visor = document.querySelector('#visor-escritorio');
  const boton = document.querySelector('#pantalla-completa');
  const estado = document.querySelector('#estado-pantalla');
  const admitida = document.fullscreenEnabled && typeof visor.requestFullscreen === 'function'
    && typeof document.exitFullscreen === 'function';
  let permitida = false;
  let cambiando = false;
  let activa = false;

  function actualizar() {
    const anterior = activa;
    activa = document.fullscreenElement === visor;
    boton.disabled = !admitida || cambiando || (!activa && !permitida);
    boton.textContent = activa ? 'Salir de pantalla completa' : 'Pantalla completa';
    if (anterior !== activa) {
      estado.textContent = activa ? 'Pulsa Escape para salir.' : '';
      if (!activa && !boton.disabled) boton.focus({ preventScroll: true });
    }
  }

  if (!admitida) estado.textContent = 'Pantalla completa no disponible en este navegador.';
  document.addEventListener('fullscreenchange', actualizar);
  boton.addEventListener('click', async () => {
    if (boton.disabled || cambiando) return;
    cambiando = true;
    estado.textContent = '';
    // Mantiene el foco mientras se completa la transición.
    boton.setAttribute('aria-busy', 'true');
    try {
      if (activa) await document.exitFullscreen();
      else await visor.requestFullscreen();
    } catch (error) {
      estado.textContent = 'El navegador no pudo cambiar el modo de pantalla.';
      console.error('NEXUS XR · Error de pantalla completa', error);
    } finally {
      cambiando = false;
      boton.removeAttribute('aria-busy');
      actualizar();
      if (!boton.disabled) boton.focus({ preventScroll: true });
    }
  });

  return (disponible) => {
    permitida = disponible;
    actualizar();
  };
}
