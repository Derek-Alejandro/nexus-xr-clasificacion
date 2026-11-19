import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { crearFisica } from './fisica.js';
import { crearMobiliario } from './mobiliario.js';
import { crearObjetos } from './objetos.js';
import { crearLaboratorio } from './laboratorio.js';
import { crearPanelVR } from './panel-vr.js';
import { crearInteraccion } from './interaccion.js';
import { crearXR } from './xr.js';
import { crearAudio } from './audio.js';
import { crearAgarres } from './agarre.js';
import { CLASIFICACION } from './config.js';
import { crearAmbiente } from './ambiente.js';

export function crearVistaPrevia(contenedor, informarCarga, informarXR) {
  const escena = new THREE.Scene();
  escena.add(crearAmbiente());

  const fisica = crearFisica();
  const agarres = crearAgarres(fisica.mundo);
  const mobiliario = crearMobiliario(escena, fisica);
  const laboratorio = crearLaboratorio(fisica, crearObjetos(escena, fisica), mobiliario);
  const { clasificacion } = laboratorio;
  const panel = crearPanelVR();
  escena.add(panel.grupo);
  const audio = crearAudio();

  const camara = new THREE.PerspectiveCamera(49, 1, 0.05, 30);
  camara.position.set(0, 3.45, 2.52);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const lienzo = renderer.domElement;
  contenedor.append(lienzo);
  const controles = new OrbitControls(camara, lienzo);
  controles.target.set(0, 0.95, -1.42);
  controles.enablePan = false;
  controles.minDistance = 2.65;
  controles.maxDistance = 7;
  controles.minPolarAngle = 0.45;
  controles.maxPolarAngle = 1.41;
  controles.minAzimuthAngle = -1.02;
  controles.maxAzimuthAngle = 1.02;
  controles.update();

  let cuadroVisible = false;
  let necesitaRender = true;
  let gestionandoXR = false;
  let interaccion;
  let destelloHasta = 0;
  const tamanoVista = new THREE.Vector2();

  function invalidar() {
    necesitaRender = true;
  }

  function reiniciar() {
    interaccion.cancelarTodo('Agarre cancelado al reiniciar');
    laboratorio.reiniciar();
    invalidar();
  }

  function actualizarVisibilidad(visible) {
    const ahora = performance.now();
    if (visible) clasificacion.reanudar(ahora);
    else clasificacion.pausar(ahora);
    fisica.interrumpir();
    invalidar();
  }

  function informarDeposito(aviso) {
    destelloHasta = performance.now() + CLASIFICACION.avisoMs;
    audio.reproducir(aviso.tipo);
    console.info('NEXUS XR · ' + aviso.texto, aviso.piezaId);
  }

  function actualizarIndicadores(tiempo) {
    const resumen = clasificacion.resumen(tiempo);
    panel.mostrarActividad(resumen, clasificacion.categorias);
    const aviso = resumen.aviso;
    for (const recipiente of mobiliario.recipientes) {
      const orientacion = laboratorio.piezas.some((pieza) => pieza.recipienteId === recipiente.id && agarres.estaSujeta(pieza));
      const confirmar = aviso?.recipienteId === recipiente.id && tiempo < destelloHasta;
      recipiente.material.emissive.setHex(confirmar ? (aviso.tipo === 'error' ? 0xff4444 : 0x54ed98) : recipiente.material.color.getHex());
      recipiente.material.emissiveIntensity = confirmar ? 0.24 : orientacion ? 0.14 : 0;
    }
  }

  const xr = crearXR(renderer, escena, (salir) => {
    interaccion = crearInteraccion(laboratorio, agarres, mobiliario.superficies, panel.botones, (id) => {
      if (id === 'salir-vr') {
        actualizarVisibilidad(false);
        void salir();
      }
      if (id === 'reiniciar') reiniciar();
      if (id === 'comenzar') clasificacion.comenzada(performance.now());
    });
    return {
      ...interaccion,
      manos: panel.mostrarManos,
      visibilidad: actualizarVisibilidad,
      anunciar: (mensaje) => console.info('NEXUS XR · ' + mensaje),
    };
  }, (estado, mensaje) => {
    const anterior = gestionandoXR;
    gestionandoXR = estado === 'opening' || estado === 'active';
    controles.enabled = !gestionandoXR;
    fisica.interrumpir();
    if (anterior && !gestionandoXR) {
      actualizarVisibilidad(false);
      controles.reset();
      redimensionar();
      invalidar();
    }
    informarXR(estado, mensaje);
  });

  function redimensionar() {
    const { clientWidth: ancho, clientHeight: alto } = contenedor;
    if (gestionandoXR || renderer.xr.isPresenting || !ancho || !alto) return;
    camara.aspect = ancho / alto;
    const fov = THREE.MathUtils.degToRad(49);
    camara.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(fov / 2) * Math.max(1, 1.22 / camara.aspect)));
    camara.updateProjectionMatrix();
    const escala = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt((3840 * 2160) / (ancho * alto)));
    renderer.getSize(tamanoVista);
    if (tamanoVista.x !== ancho || tamanoVista.y !== alto || renderer.getPixelRatio() !== escala) {
      renderer.setDrawingBufferSize(ancho, alto, escala);
    }
    invalidar();
  }

  function renderizar(tiempo, frame) {
    try {
      const suspendida = frame ? frame.session.visibilityState !== 'visible' : document.hidden || gestionandoXR;
      if (suspendida) {
        fisica.interrumpir();
        return;
      }
      if (frame) {
        escena.updateMatrixWorld();
        if (!xr.actualizar(frame)) return;
        if (clasificacion.estado === 'pausa') clasificacion.reanudar(tiempo);
      }
      const hayMovimiento = laboratorio.paso(tiempo, agarres, informarDeposito);
      if (!frame && !necesitaRender && !hayMovimiento) return;
      necesitaRender = false;
      actualizarIndicadores(tiempo);
      panel.dibujarSiCambio();
      renderer.render(escena, camara);
    } catch (error) {
      if (frame) {
        cuadroVisible = false;
        informarCarga('error', 'Error durante el render XR. Revisa Console.');
        void xr.salir();
      } else {
        queueMicrotask(() => renderer.setAnimationLoop(null));
        informarCarga('error', 'Se interrumpió la vista previa. Revisa Console y recarga la página.');
      }
      console.error('NEXUS XR · Error durante el cuadro', error);
      interaccion.cancelarTodo('Agarre cancelado por error de simulación');
      return;
    }

    if (!cuadroVisible && !renderer.getContext().isContextLost()) {
      cuadroVisible = true;
      informarCarga('ready', 'Three.js y cannon-es cargados · Simulación física activa');
    }
  }

  function perderContexto(evento) {
    evento.preventDefault();
    fisica.interrumpir();
    interaccion.cancelarTodo('Agarre cancelado por pérdida de WebGL');
    renderer.setAnimationLoop(null);
    void xr.salir();
    informarCarga('error', 'Se perdió el contexto WebGL. Si la vista no se recupera, recarga la página.');
  }

  function restaurarContexto() {
    cuadroVisible = false;
    informarCarga('pending', 'Restaurando la vista previa WebGL…');
    redimensionar();
    renderer.setAnimationLoop(renderizar);
  }

  const observador = new ResizeObserver(redimensionar);
  observador.observe(contenedor);
  window.addEventListener('resize', redimensionar);
  document.addEventListener('visibilitychange', fisica.interrumpir);
  controles.addEventListener('change', invalidar);
  lienzo.addEventListener('webglcontextlost', perderContexto);
  lienzo.addEventListener('webglcontextrestored', restaurarContexto);
  redimensionar();
  renderer.setAnimationLoop(renderizar);

  return {
    reiniciar,
    probarCaida() {
      const iniciada = laboratorio.probarCaida();
      if (iniciada) invalidar();
      return iniciada;
    },
    entrar() {
      controles.saveState();
      audio.activar();
      return xr.entrar();
    },
    async liberar() {
      observador.disconnect();
      window.removeEventListener('resize', redimensionar);
      document.removeEventListener('visibilitychange', fisica.interrumpir);
      controles.removeEventListener('change', invalidar);
      controles.dispose();
      renderer.setAnimationLoop(null);
      await xr.liberar();
      agarres.cancelarTodo();
      fisica.liberar();
      audio.liberar();
      lienzo.removeEventListener('webglcontextlost', perderContexto);
      lienzo.removeEventListener('webglcontextrestored', restaurarContexto);
      const geometrias = new Set();
      const materiales = new Set();
      escena.traverse((objeto) => {
        if (objeto.isInstancedMesh) objeto.dispose();
        if (objeto.geometry) geometrias.add(objeto.geometry);
        if (objeto.material) materiales.add(objeto.material);
      });
      geometrias.forEach((geometria) => geometria.dispose());
      materiales.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
      lienzo.remove();
    },
  };
}
