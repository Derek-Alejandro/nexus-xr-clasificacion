import {
  CylinderGeometry, DynamicDrawUsage, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, Quaternion,
  Ray, SphereGeometry, Vector3,
} from 'three';

const LADOS = { left: 'Izquierda', right: 'Derecha' };
const ETIQUETAS = { ausente: 'sin seguimiento', lista: 'detectada', pinza: 'pinza activa' };

function crearMano(lado, color, articulacion, rayoGeometria, cursorGeometria) {
  const grupo = new Group();
  grupo.visible = false;
  const material = new MeshBasicMaterial({ color });
  const puntos = new InstancedMesh(articulacion, material, 25);
  puntos.instanceMatrix.setUsage(DynamicDrawUsage);
  puntos.frustumCulled = false;
  const linea = new Mesh(rayoGeometria, material);
  const cursor = new Mesh(cursorGeometria, material);
  grupo.add(puntos, linea, cursor);
  return {
    lado, grupo, puntos, linea, cursor, fuente: null, estado: 'ausente', pinza: false,
    rayo: new Ray(),
  };
}

export function crearXR(renderer, escena, conectarEntrada, informar) {
  const gestor = renderer.xr;
  gestor.enabled = true;
  gestor.setReferenceSpaceType('local-floor');
  const articulacion = new SphereGeometry(1, 8, 6);
  const rayoGeometria = new CylinderGeometry(0.0018, 0.0018, 1, 6);
  rayoGeometria.rotateX(-Math.PI / 2);
  const cursorGeometria = new SphereGeometry(0.008, 10, 8);
  const manos = {
    left: crearMano(LADOS.left, 0x66e7ff, articulacion, rayoGeometria, cursorGeometria),
    right: crearMano(LADOS.right, 0xb79aff, articulacion, rayoGeometria, cursorGeometria),
  };
  const pares = Object.entries(manos);
  pares.forEach(([, mano]) => escena.add(mano.grupo));
  const datosInstancia = new Object3D();
  const rotacion = new Quaternion();
  const frente = new Vector3();
  let sesion = null;
  let escuchas = null;
  let referencia = null;
  let solicitando = false;
  let cierre = null;
  let destruido = false;
  const entrada = conectarEntrada(salir);

  function publicarManos() {
    entrada.manos(
      pares.map(([lado, mano]) => `${LADOS[lado]}: ${ETIQUETAS[mano.estado]}`),
    );
  }

  function estadoMano(lado, mano, estado) {
    if (mano.estado === estado) return;
    const anterior = mano.estado;
    mano.estado = estado;
    if (estado === 'ausente' || (estado === 'lista' && anterior === 'ausente')) {
      console.info(`NEXUS XR · Mano ${LADOS[lado].toLowerCase()}: ${ETIQUETAS[estado]}`);
    }
    publicarManos();
  }

  function retirar(lado, mano, motivo = 'Seguimiento perdido') {
    entrada.retirar(mano, motivo);
    mano.grupo.visible = false;
    mano.pinza = false;
    estadoMano(lado, mano, 'ausente');
  }

  function leerRayo(mano, frame) {
    const pose = frame.getPose(mano.fuente.targetRaySpace, referencia);
    if (!pose) return false;
    mano.rayo.origin.copy(pose.transform.position);
    mano.rayo.direction.set(0, 0, -1).applyQuaternion(pose.transform.orientation);
    return true;
  }

  function dibujarMano(mano, frame, muneca, poseMuneca, distancia) {
    let indice = 0;
    for (const articulacionXR of mano.fuente.hand.values()) {
      const pose = articulacionXR === muneca ? poseMuneca : frame.getJointPose(articulacionXR, referencia);
      if (!pose || indice >= 25) continue;
      datosInstancia.position.copy(pose.transform.position);
      datosInstancia.scale.setScalar(pose.radius || 0.007);
      datosInstancia.updateMatrix();
      mano.puntos.setMatrixAt(indice++, datosInstancia.matrix);
    }
    mano.puntos.count = indice;
    mano.puntos.instanceMatrix.needsUpdate = true;
    mano.rayo.at(distancia / 2, mano.linea.position);
    mano.linea.quaternion.setFromUnitVectors(frente.set(0, 0, -1), mano.rayo.direction);
    mano.linea.scale.z = distancia;
    mano.rayo.at(distancia, mano.cursor.position);
    mano.cursor.scale.setScalar(mano.pinza ? 1.65 : 1);
    mano.grupo.visible = true;
  }

  function actualizar(frame) {
    if (!sesion || cierre) return false;
    if (!referencia) {
      const base = gestor.getReferenceSpace();
      const pose = base && frame.getViewerPose(base);
      if (!pose) return false;
      frente.set(0, 0, -1).applyQuaternion(pose.transform.orientation);
      const rumbo = Math.atan2(-frente.x, -frente.z);
      rotacion.setFromAxisAngle(frente.set(0, 1, 0), rumbo);
      const { x, z } = pose.transform.position;
      referencia = base.getOffsetReferenceSpace(new XRRigidTransform({ x, y: 0, z }, rotacion));
      gestor.setReferenceSpace(referencia);
      return false;
    }

    for (const [lado, mano] of pares) {
      const muneca = mano.fuente?.hand.get('wrist');
      const poseMuneca = sesion.visibilityState === 'visible' && muneca && frame.getJointPose(muneca, referencia);
      if (!poseMuneca || !leerRayo(mano, frame)) {
        if (mano.estado !== 'ausente') retirar(lado, mano);
        continue;
      }
      estadoMano(lado, mano, mano.pinza ? 'pinza' : 'lista');
      dibujarMano(mano, frame, muneca, poseMuneca, entrada.actualizar(mano, mano.rayo));
    }
    entrada.actualizarAspecto();
    return true;
  }

  function sincronizarFuentes() {
    const fuentes = Array.from(sesion.inputSources);
    for (const [lado, mano] of pares) {
      const fuente = fuentes.find((item) => item.hand && item.handedness === lado) ?? null;
      if (mano.fuente !== fuente) {
        retirar(lado, mano);
        mano.fuente = fuente;
      }
    }
  }

  function seleccionar(evento) {
    if (!referencia || cierre || sesion?.visibilityState !== 'visible') return;
    const lado = evento.inputSource.handedness;
    const mano = manos[lado];
    if (!evento.inputSource.hand || mano?.fuente !== evento.inputSource) return;
    if (evento.type === 'selectend') {
      if (!mano.pinza) return;
      mano.pinza = false;
      entrada.terminar(mano, null);
      if (mano.estado === 'pinza') estadoMano(lado, mano, 'lista');
      return;
    }
    // El cuadro de un evento de entrada puede diferir del último cuadro animado.
    const muneca = mano.fuente.hand.get('wrist');
    if (!muneca || !evento.frame.getJointPose(muneca, referencia) || !leerRayo(mano, evento.frame)) {
      retirar(lado, mano);
      return;
    }
    switch (evento.type) {
      case 'selectstart':
        if (mano.pinza) return;
        mano.pinza = true;
        estadoMano(lado, mano, 'pinza');
        entrada.iniciar(mano, mano.rayo);
        break;
      case 'select':
        // WebXR emite select antes de selectend al completar una acción.
        if (!mano.pinza) return;
        mano.pinza = false;
        estadoMano(lado, mano, 'lista');
        entrada.terminar(mano, mano.rayo);
        break;
    }
  }

  function limpiar() {
    escuchas?.abort();
    escuchas = null;
    for (const [lado, mano] of pares) {
      retirar(lado, mano, 'Agarre cancelado al cerrar VR');
      mano.fuente = null;
    }
    entrada.manos([]);
    referencia = null;
    sesion = null;
    cierre = null;
  }

  function salir() {
    if (!sesion || cierre) return cierre;
    const activa = sesion;
    for (const [lado, mano] of pares) retirar(lado, mano, 'Agarre cancelado al salir de VR');
    cierre = Promise.resolve().then(() => activa.end()).catch((error) => {
      if (sesion === activa) {
        cierre = null;
        entrada.anunciar('No se pudo cerrar la sesión. Usa la salida del visor.');
      }
      console.error('NEXUS XR · Error al cerrar VR', error);
    });
    return cierre;
  }

  return {
    actualizar,
    async entrar() {
      if (sesion || solicitando || destruido) return;
      solicitando = true;
      informar('opening', 'Solicitando VR y seguimiento de manos…');
      console.info('NEXUS XR · Solicitud immersive-vr', ['hand-tracking', 'local-floor']);
      try {
        const nueva = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['hand-tracking', 'local-floor'],
        });
        if (destruido) {
          await nueva.end();
          return;
        }
        sesion = nueva;
        const inicio = gestor.setSession(nueva);
        escuchas = new AbortController();
        const opciones = { signal: escuchas.signal };
        nueva.addEventListener('end', () => {
          const solicitada = Boolean(cierre);
          limpiar();
          if (destruido) return;
          const mensaje = solicitada
            ? 'Sesión VR finalizada.'
            : 'La sesión VR terminó desde el visor o el navegador. Puedes volver a entrar.';
          informar('idle', mensaje);
          entrada.anunciar(mensaje);
        }, opciones);
        nueva.addEventListener('inputsourceschange', sincronizarFuentes, opciones);
        nueva.addEventListener('visibilitychange', () => {
          const visible = nueva.visibilityState === 'visible';
          entrada.visibilidad?.(visible);
          if (visible) return;
          for (const [lado, mano] of pares) retirar(lado, mano);
        }, opciones);
        for (const tipo of ['selectstart', 'select', 'selectend']) {
          nueva.addEventListener(tipo, seleccionar, opciones);
        }
        await inicio;
        if (sesion !== nueva) return;
        sincronizarFuentes();
        publicarManos();
        entrada.visibilidad?.(nueva.visibilityState === 'visible');
        entrada.anunciar('Sesión VR iniciada. Muestra las manos para comenzar.');
        informar('active', 'Sesión VR iniciada. Las manos se detectan dentro de VR.');
      } catch (error) {
        await salir();
        const mensaje = error.name === 'NotAllowedError' || error.name === 'SecurityError'
          ? 'Permiso de VR denegado o bloqueado por el navegador.'
          : error.name === 'NotSupportedError'
            ? 'El entorno no concedió VR con seguimiento de manos y referencia de piso.'
            : 'No se pudo iniciar VR. Revisa Console e inténtalo de nuevo.';
        informar('error', mensaje);
        console.error('NEXUS XR · Error al iniciar VR', error);
      } finally {
        solicitando = false;
      }
    },
    salir,
    async liberar() {
      destruido = true;
      await salir();
      limpiar();
    },
  };
}
