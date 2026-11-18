import {
  comprobarRecursosPortada, comprobarWebXR, mostrarCarga, mostrarXR, prepararPantallaCompleta,
} from './portada.js';

const boton = document.querySelector('#entrar-vr');
const probarCaida = document.querySelector('#prueba-caida');
const reiniciarFisica = document.querySelector('#reiniciar-fisica');
const estadoFisica = document.querySelector('#estado-fisica');
const habilitarPantallaCompleta = prepararPantallaCompleta();
let vista;
let compatible = false;
let lista = false;
let estadoXR = 'idle';
let revisionCompatibilidad = 0;
let diagnosticoAnterior = '';

function actualizarBoton() {
  const escritorio = estadoXR !== 'opening' && estadoXR !== 'active';
  boton.disabled = !vista || !lista || !escritorio || !compatible;
  probarCaida.disabled = reiniciarFisica.disabled = !vista || !lista || !escritorio;
  habilitarPantallaCompleta(Boolean(vista && lista && escritorio));
}

function informarCarga(estado, mensaje) {
  lista = estado === 'ready';
  mostrarCarga(estado, mensaje);
  actualizarBoton();
}

function informarXR(estado, mensaje) {
  estadoXR = estado;
  mostrarXR(mensaje);
  actualizarBoton();
  if (estado === 'idle' || estado === 'error') {
    if (!boton.disabled) boton.focus({ preventScroll: true });
    void actualizarCompatibilidad(false);
  }
}

async function iniciarVistaPrevia() {
  let crearVistaPrevia;

  try {
    ({ crearVistaPrevia } = await import('./escena.js'));
  } catch (error) {
    mostrarCarga('error', 'No se pudieron cargar los módulos 3D o cannon-es. Revisa las solicitudes del CDN en Network.');
    console.error('NEXUS XR · Error al importar los módulos 3D', error);
    return;
  }

  mostrarCarga('pending', 'Three.js y cannon-es cargados. Iniciando WebGL…');

  try {
    vista = crearVistaPrevia(document.querySelector('#vista-previa'), informarCarga, informarXR);
    window.addEventListener('pagehide', (evento) => {
      if (!evento.persisted) void vista.liberar();
    });
  } catch (error) {
    mostrarCarga('error', 'No se pudo iniciar la vista previa WebGL. Revisa la aceleración gráfica y los detalles en Console.');
    console.error('NEXUS XR · Error al iniciar la vista previa', error);
  }
}

async function actualizarCompatibilidad(mostrar = true) {
  const revision = ++revisionCompatibilidad;
  const resultado = await comprobarWebXR();
  if (revision !== revisionCompatibilidad) return;
  compatible = resultado.compatible;
  if (diagnosticoAnterior !== resultado.mensaje) {
    console.info('NEXUS XR · Compatibilidad · ' + resultado.mensaje);
    diagnosticoAnterior = resultado.mensaje;
  }
  if ((mostrar || !compatible) && estadoXR !== 'opening' && estadoXR !== 'active') {
    mostrarXR(resultado.mensaje);
  }
  actualizarBoton();
}

boton.addEventListener('click', () => {
  if (!boton.disabled) void vista.entrar();
});
probarCaida.addEventListener('click', () => {
  estadoFisica.textContent = vista.probarCaida()
    ? 'Prueba iniciada con cuatro figuras.'
    : 'Redistribuye las figuras antes de repetir la prueba.';
});
reiniciarFisica.addEventListener('click', () => {
  vista.reiniciar();
  estadoFisica.textContent = 'Nueva distribución lista.';
});
navigator.xr?.addEventListener('devicechange', () => void actualizarCompatibilidad());
if (document.readyState === 'complete') comprobarRecursosPortada();
else window.addEventListener('load', comprobarRecursosPortada, { once: true });
void actualizarCompatibilidad();
void iniciarVistaPrevia();
