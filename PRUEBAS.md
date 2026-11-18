# Pruebas de aceptación · NEXUS XR 3.2 · Etapas 3 y 4

## Suite física en Chrome

Abre el laboratorio mediante Live Server. En DevTools → Console, ejecuta:

```js
const { ejecutarPruebasLaboratorio } = await import('./js/pruebas-laboratorio.js');
ejecutarPruebasLaboratorio();
```

La suite crea un mundo aislado con los módulos reales y devuelve una tabla con el resultado observado. Comprueba gravedad e inventario, 64 inicializaciones, paso fijo e interrupciones, reposo en las cuatro mesas, choques, piso, paredes y capacidad de los recipientes. La etapa 4 añade oclusión del rayo, exclusión por pieza, movimiento 3D, liberación, resistencia de una pared durante el agarre y recuperación sin restricciones huérfanas. Utiliza rayos y objetivos de prueba sobre el código de producción sin abrir una sesión WebXR.

**Resultado registrado el 18 de noviembre de 2026:** 7/7 en Chrome headless con un servidor HTTP local de prueba, tanto desde la raíz como desde el subdirectorio `/nexus-xr-clasificacion-32/`. La vista previa llegó al estado `ready`, cargó Three.js, cannon-es y Bootstrap desde jsDelivr, y los controles **Probar caída** y **Redistribuir** respondieron sin excepciones de aplicación registradas. La revisión visual de escritorio confirmó el encuadre de las cuatro mesas. La ejecución mediante la extensión Live Server, el despliegue en GitHub Pages y las pruebas en Quest 3 quedan pendientes.

**Resultado de la etapa 4:** 11/11 en Chrome headless con un servidor HTTP local y el CDN real. La vista previa cargó y respondió a **Probar caída** y **Redistribuir**. Las pruebas con Immersive Web Emulator y en Meta Quest 3 quedan pendientes.

## Checklist manual reproducible

Registra URL, revisión, navegador, dispositivo y resultado observado al ejecutar cada fila.

| # | Verificación | Evidencia esperada |
|---:|---|---|
| 1 | Abrir Network y recargar. | Se carga el módulo de cannon-es 0.20.0 por HTTPS, junto con Three.js 0.183.0 y Bootstrap 5.3.8. |
| 2 | Pulsar **Probar caída**. | Las cuatro figuras descienden hasta el fondo de los recipientes por efecto de la gravedad. |
| 3 | Orbitar alrededor de las cuatro mesas. | Las cuatro cubiertas son visibles y sostienen las figuras. |
| 4 | Contar las piezas después de **Redistribuir**. | Hay veinte figuras. |
| 5 | Contar las piezas por mesa. | Hay cinco por mesa y todas las categorías están representadas. |
| 6 | Contar las piezas por categoría. | Hay cinco esferas, cinco cubos, cinco pirámides y cinco prismas hexagonales, con los colores requeridos. |
| 7 | Pulsar varias veces **Redistribuir**. | Las piezas aparecen separadas y cerca de la superficie; ninguna invade un recipiente. |
| 8 | Orbitar por encima y pulsar **Probar caída**. | Se distinguen los fondos y las cuatro bocas abiertas. Una figura entra por cada boca. |
| 9 | Esperar el asentamiento tras redistribuir. | Las figuras reposan sobre la cubierta, sin flotación visible. |
| 10 | Ejecutar el caso de choque entre cuerpos. | El choque se registra y la segunda esfera se desplaza. |
| 11 | Ejecutar los casos de piso, paredes y capacidad. | El piso y los recipientes contienen las figuras bajo las velocidades y posiciones de la prueba. |
| 12 | Pulsar **Redistribuir** tras una caída. | Los recipientes quedan vacíos y las veinte figuras vuelven a las mesas con otra distribución válida. |
| 13 | Abrir la carpeta con **Live Server**, orbitar, acercar, activar pantalla completa y salir con Escape. | Vista previa operativa y encuadre correcto al restaurar la ventana. |
| 14 | Inspeccionar Console y Network. | Sin excepciones de aplicación ni errores de módulos, rutas, MIME o CORS. |
| 15 | Servir una copia desde el subdirectorio HTTPS del repositorio de 3.2. | Los módulos, CSS, favicon y CDN se resuelven desde GitHub Pages. Registrar la URL al publicar. |

## Immersive Web Emulator en Chrome

1. Abre la página en `localhost` con Live Server. Activa la extensión **Immersive Web Emulator** en esa pestaña y recarga.
2. Selecciona un perfil de Quest y cambia el modo de entrada a **Hands**. Abre DevTools en la pestaña **WebXR** para revisar la configuración de la extensión.
3. Pulsa **Entrar a Realidad Virtual**. Usa los controles de pose de la extensión para orientar y mover la mano izquierda o derecha y su control de pinza para cerrar y abrir. Apunta a una figura, ciérrala, eleva la mano, cambia su orientación y abre la pinza sobre un recipiente.
4. Repite con la otra mano. Prueba ambas pinzas sobre la misma figura. Si tu versión permite desconectar una mano, hazlo durante un agarre. Reinicia o sal mediante el panel y vuelve a entrar.

[Documentación oficial de Immersive Web Emulator](https://github.com/meta-quest/immersive-web-emulator)

## Meta Quest 3

Abre una **URL HTTPS** en Meta Quest Browser con el seguimiento de manos activado. Pulsa **Entrar a Realidad Virtual** y recorre la checklist sentado y de pie, con ambas manos y desde las cuatro mesas. Usa una pinza cómoda con la palma orientada hacia el laboratorio. Los gestos de sistema pueden interrumpir la entrada. Registra versión del navegador, URL, revisión y resultado de cada fila.

| # | Verificación | Resultado esperado en emulador y visor |
|---:|---|---|
| 1 | Entrar a VR desde la portada. | Comienza `immersive-vr`, con piso alineado y diagnóstico de sesión. |
| 2 | Mostrar primero una mano y luego la otra. | El panel distingue ambas manos y sus rayos. |
| 3 | Apuntar a piezas de las cuatro mesas y detrás de un obstáculo. | Se resalta la figura visible. Una mesa o pared opaca bloquea la selección detrás de ella. |
| 4 | Cerrar una pinza sobre cada categoría. | La pieza capturada cambia de brillo y aparece un único inicio de agarre en Console. |
| 5 | Desplazar la mano y cambiar el rumbo del rayo. | La figura se mueve en X, Y y Z. Un cambio de pose abrupto produce una transición limitada. |
| 6 | Abrir la pinza sobre una mesa, un recipiente y el piso. | Se registra una sola liberación y la figura cae por gravedad. Si se estabiliza en el piso vuelve a una posición libre de su mesa. |
| 7 | Empujar contra cubiertas, bordes y paredes. | La figura conserva la colisión durante el agarre y al soltarla. |
| 8 | Agarrar la misma figura con ambas manos. | La primera mantiene el control. Las dos manos pueden sujetar piezas distintas. |
| 9 | Ocultar la mano o abrir el menú del sistema durante el agarre. | La figura deja de seguir la mano y cae sin impulso de cancelación. Se puede volver a tomar tras recuperar seguimiento. |
| 10 | Reiniciar con la otra mano, salir durante un agarre y volver a entrar. | Las capturas se cancelan, el reinicio redistribuye y la sesión siguiente permite agarrar de nuevo. Probar salida del HUD y del sistema. |

En **Console**, filtra por `NEXUS XR` para ver sesión, mano detectada o perdida, figura apuntada, agarre activo, liberación, recuperación y fallos de simulación. El diagnóstico de puntería se emite al cambiar de figura.

### Limitaciones de la etapa 4

- El agarre conserva la profundidad inicial del rayo. El movimiento de la mano y su ángulo modifican el objetivo. La figura puede girar como resultado de la restricción y los contactos.
- Las colisiones son discretas y la contención se comprobó en escenarios controlados. Las pruebas del visor deben cubrir distintos ángulos de contacto, movimientos bruscos y el rendimiento con las dos manos activas.
- La extensión verifica el camino de eventos WebXR. La precisión del tracking, las oclusiones reales y el confort requieren el visor.
