import { Raycaster, Vector3 } from 'three';

export function crearInteraccion(laboratorio, agarres, superficies, botones, ejecutarControl) {
  const raycaster = new Raycaster();
  raycaster.far = 4;
  const candidatos = [...superficies, ...botones, ...laboratorio.piezas.map(({ malla }) => malla)];
  const impactos = [];
  const focos = new Map();
  const capturas = new Map();
  const punto = new Vector3();
  const { clasificacion } = laboratorio;

  function seleccionable(pieza) {
    return clasificacion.estado === 'en-curso' && !clasificacion.clasificada(pieza) && !agarres.estaSujeta(pieza);
  }

  function diagnostico(mano, mensaje, detalle) {
    console.info('NEXUS XR · ' + mano.lado + ' · ' + mensaje, detalle);
  }

  function impacto(rayo) {
    raycaster.ray.copy(rayo);
    impactos.length = 0;
    raycaster.intersectObjects(candidatos, false, impactos);
    return impactos[0];
  }

  function enfocar(mano, objeto) {
    if (focos.get(mano) === objeto) return;
    if (objeto) {
      focos.set(mano, objeto);
      if (objeto.userData.tipo === 'pieza') diagnostico(mano, 'Figura apuntada', objeto.name);
    } else {
      focos.delete(mano);
    }
  }

  function terminar(mano, rayo, motivo = 'Pinza cancelada') {
    const captura = capturas.get(mano);
    if (!captura) return;
    capturas.delete(mano);
    if (captura.pieza) {
      if (agarres.terminar(mano, Boolean(rayo))) {
        if (rayo) clasificacion.liberar(captura.pieza);
        diagnostico(mano, rayo ? 'Liberación' : motivo, captura.pieza.id + ' · dinámica y gravedad activas');
      }
    } else if (rayo && impacto(rayo)?.object === captura.control) {
      ejecutarControl(captura.control.userData.id);
    }
  }

  return {
    actualizar(mano, rayo) {
      const captura = capturas.get(mano);
      if (captura?.pieza) {
        agarres.apuntar(mano, rayo.at(captura.distancia, punto));
        return captura.distancia;
      }
      const choque = impacto(rayo);
      const objeto = choque?.object;
      const pieza = laboratorio.piezasPorId.get(objeto?.userData.id);
      const controlDisponible = objeto?.userData.tipo === 'control' && !objeto.userData.inactivo;
      enfocar(mano, controlDisponible || (pieza && seleccionable(pieza)) ? objeto : null);
      return choque?.distance ?? 2.1;
    },
    actualizarAspecto() {
      const enfocados = [...focos.values()];
      for (const boton of botones) {
        const pulsado = [...capturas.values()].some(({ control }) => control === boton);
        boton.material.color.setHex(boton.userData.inactivo ? 0x254354
          : pulsado ? 0xa0f5ff : enfocados.includes(boton) ? 0x67ebfa : 0x3c7895);
      }
      for (const pieza of laboratorio.piezas) {
        const { malla } = pieza;
        malla.material.emissive.copy(malla.material.color);
        malla.material.emissiveIntensity = agarres.estaSujeta(pieza) ? 0.55 : enfocados.includes(malla) ? 0.25 : 0;
      }
    },
    iniciar(mano, rayo) {
      if (capturas.has(mano)) return;
      const choque = impacto(rayo);
      if (!choque) return;
      const { object: objeto, distance: distancia } = choque;
      if (objeto.userData.tipo === 'control') {
        if (!objeto.userData.inactivo) capturas.set(mano, { control: objeto });
        return;
      }
      const pieza = laboratorio.piezasPorId.get(objeto.userData.id);
      if (!pieza) return;
      if (!seleccionable(pieza) || !agarres.iniciar(mano, pieza, choque.point)) {
        diagnostico(mano, 'Figura no disponible', pieza.id);
        return;
      }
      clasificacion.cancelar(pieza);
      capturas.set(mano, { pieza, distancia });
      diagnostico(mano, 'Inicio del agarre · restricción física activa', pieza.id);
    },
    terminar,
    retirar(mano, motivo) {
      terminar(mano, null, motivo);
      focos.delete(mano);
    },
    cancelarTodo(motivo) {
      for (const mano of capturas.keys()) terminar(mano, null, motivo);
      focos.clear();
    },
  };
}
