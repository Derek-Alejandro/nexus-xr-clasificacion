import {
  BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace,
} from 'three';
import { formatearTiempo } from './clasificacion.js';

export function crearSuperficieTexto(ancho, alto, pixeles, dibujar) {
  const canvas = document.createElement('canvas');
  canvas.width = pixeles;
  canvas.height = Math.round(pixeles * alto / ancho);
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('No se pudo crear la textura de texto 3D.');

  const textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;
  textura.anisotropy = 4;
  const malla = new Mesh(new PlaneGeometry(ancho, alto), new MeshBasicMaterial({ map: textura }));

  function actualizar() {
    dibujar(contexto, canvas.width, canvas.height);
    textura.needsUpdate = true;
  }

  actualizar();
  return { malla, actualizar };
}

export function crearPanelVR() {
  const grupo = new Group();
  grupo.position.set(0, 1.64, -2.30);
  let manos = [];
  let necesitaDibujo = false;
  let firma = '';
  let datos;
  let categorias = [];
  const estados = { lista: 'Lista', 'en-curso': 'En curso', pausa: 'En pausa', completada: 'Completada' };
  const carcasa = new Mesh(new BoxGeometry(1.56, 0.72, 0.04), new MeshBasicMaterial({ color: 0x285876 }));
  grupo.add(carcasa);

  const pantalla = crearSuperficieTexto(1.52, 0.69, 1200, (ctx, w, h) => {
    ctx.fillStyle = '#0c192b';
    ctx.fillRect(0, 0, w, h);
    function texto(valor, x, y, tamano, color = '#ecf7ff', maximo = w - x - 24) {
      ctx.font = '600 ' + tamano + 'px system-ui';
      ctx.fillStyle = color;
      ctx.fillText(valor, x, y, maximo);
    }
    texto('NEXUS XR 3.2', 32, 60, 46, '#67ebfa');
    if (!datos) return;
    texto(estados[datos.estado], 790, 52, 26, '#c2d5e6');
    manos.forEach((mano, i) => texto(mano, 790, 82 + i * 26, 21, '#b2cce4'));
    const metricas = [
      ['Progreso', datos.aciertos + '/' + datos.total, 32],
      ['Puntos disponibles', datos.puntos + '/' + datos.total, 420],
      ['Tiempo global', formatearTiempo(datos.tiempoMs), 830],
    ];
    for (const [etiqueta, valor, x] of metricas) {
      texto(etiqueta, x, 137, 26, '#b2cce4');
      texto(valor, x, 183, 44);
    }

    categorias.forEach(({ nombre, simbolo, color, aciertos, tiempo }, i) => {
      const x = 32 + i * 292;
      texto(simbolo + ' ' + nombre, x, 236, 25, '#' + color.toString(16).padStart(6, '0'), 271);
      texto(aciertos + '/5', x, 272, 32);
      texto(tiempo === null ? 'Pendiente' : formatearTiempo(tiempo), x, 307, 24, '#b2cce4');
    });
    texto('Aciertos ' + datos.aciertos + '    Errores ' + datos.errores + '    Intentos ' + datos.intentos
      + '    Precisión ' + datos.precision.toFixed(1).replace('.', ',') + ' %', 32, 360, 28);

    const aviso = datos.aviso;
    const mensaje = aviso?.texto ?? (datos.estado === 'lista' ? 'Pulsa Comenzar para iniciar.' : 'Suelta la figura por encima de la boca.');
    texto(mensaje, 32, 415, 32, aviso ? (aviso.tipo === 'error' ? '#ff9696' : '#7cf1a9') : '#b2cce4');
  });
  pantalla.malla.position.z = 0.021;
  grupo.add(pantalla.malla);

  const botones = [
    { id: 'comenzar', texto: 'Comenzar', x: -0.48 },
    { id: 'reiniciar', texto: 'Reiniciar', x: 0 },
    { id: 'salir-vr', texto: 'Salir de VR', x: 0.48 },
  ].map(({ id, texto, x }) => {
    const boton = new Mesh(new BoxGeometry(0.40, 0.079, 0.024), new MeshBasicMaterial({ color: 0x3c7895 }));
    boton.name = texto;
    boton.userData = { tipo: 'control', id };
    boton.position.set(x, -0.265, 0.037);
    const etiqueta = crearSuperficieTexto(0.386, 0.068, 340, (ctx, w, h) => {
      ctx.fillStyle = '#173952';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e6f7ff';
      ctx.font = 'bold 32px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(texto, w / 2, h / 2, w - 16);
    });
    etiqueta.malla.position.z = 0.013;
    boton.add(etiqueta.malla);
    grupo.add(boton);
    return boton;
  });

  return {
    grupo, botones,
    mostrarActividad(resumen, filas) {
      const siguiente = [resumen.estado, resumen.aciertos, resumen.errores,
        Math.floor(resumen.tiempoMs / 1000), resumen.aviso?.recipienteId, resumen.aviso?.texto].join('|');
      if (siguiente === firma) return;
      firma = siguiente;
      datos = resumen;
      categorias = filas;
      botones[0].userData.inactivo = resumen.estado !== 'lista';
      botones[0].material.color.setHex(botones[0].userData.inactivo ? 0x254354 : 0x3c7895);
      necesitaDibujo = true;
    },
    mostrarManos(estadosManos) {
      manos = estadosManos;
      necesitaDibujo = true;
    },
    dibujarSiCambio() {
      if (!necesitaDibujo) return;
      pantalla.actualizar();
      necesitaDibujo = false;
    },
  };
}
