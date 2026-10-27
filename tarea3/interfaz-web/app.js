const GRUPO_DEMO = '11111111-1111-1111-1111-111111111101';

const elementos = {
  pulso: document.querySelector('.pulso'),
  estadoTexto: document.querySelector('#estadoTexto'),
  endpointTexto: document.querySelector('#endpointTexto'),
  formConsulta: document.querySelector('#formConsulta'),
  grupoId: document.querySelector('#grupoId'),
  limite: document.querySelector('#limite'),
  limiteValor: document.querySelector('#limiteValor'),
  lista: document.querySelector('#listaCatequizandos'),
  resultadoTitulo: document.querySelector('#resultadoTitulo'),
  duracionConsulta: document.querySelector('#duracionConsulta'),
  formMutacion: document.querySelector('#formMutacion'),
  catequizandoId: document.querySelector('#catequizandoId'),
  fecha: document.querySelector('#fecha'),
  estado: document.querySelector('#estado'),
  recorrido: document.querySelector('#recorridoMutacion'),
  mensajeMutacion: document.querySelector('#mensajeMutacion'),
  codigoSolicitud: document.querySelector('#codigoSolicitud'),
  codigoRespuesta: document.querySelector('#codigoRespuesta'),
  codigoEstado: document.querySelector('#codigoEstado'),
};

function consultaCatequizandos(campos, limite) {
  return `query ListaCatequizandos($grupoId: ID!) {
  catequizandos(grupoId: $grupoId, primero: ${limite}) {
    total
    nodos {
      ${campos.join('\n      ')}
    }
  }
}`;
}

async function ejecutarGraphql(query, variables) {
  elementos.codigoSolicitud.textContent = `${query}\n\nVariables:\n${JSON.stringify(variables, null, 2)}`;
  elementos.codigoRespuesta.textContent = 'Esperando respuesta del servidor…';
  elementos.codigoEstado.textContent = 'enviando';
  const respuesta = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const contenido = await respuesta.json();
  const duracion = Number(respuesta.headers.get('x-sigecat-duracion-ms') ?? 0);
  elementos.codigoRespuesta.textContent = JSON.stringify(contenido, null, 2);
  elementos.codigoEstado.textContent = `HTTP ${respuesta.status} · ${duracion} ms`;
  if (!respuesta.ok || contenido.errors?.length) {
    throw new Error(contenido.errors?.[0]?.message ?? contenido.error ?? 'GraphQL rechazó la operación');
  }
  return { datos: contenido.data, duracion };
}

function iniciales(nombre) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
}

function renderizarPersonas(resultado, campos) {
  elementos.lista.replaceChildren();
  elementos.lista.className = 'lista-datos';
  for (const persona of resultado.nodos) {
    const fila = document.createElement('article');
    fila.className = 'fila-persona';

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = iniciales(persona.identidadOperativa ?? 'ID');

    const identidad = document.createElement('div');
    const nombre = document.createElement('strong');
    nombre.textContent = persona.identidadOperativa ?? 'Identidad no solicitada';
    const id = document.createElement('small');
    id.textContent = persona.id ?? 'ID no solicitado';
    identidad.append(nombre, id);

    const extras = document.createElement('div');
    extras.className = 'dato-extra';
    if (campos.includes('edad') && persona.edad !== undefined) {
      const edad = document.createElement('span');
      edad.textContent = `${persona.edad} años`;
      extras.append(edad);
    }
    if (persona.riesgo) {
      const riesgo = document.createElement('span');
      riesgo.className = 'riesgo';
      riesgo.textContent = `${persona.riesgo.nivel}: ${persona.riesgo.motivo}`;
      extras.append(riesgo);
    }
    fila.append(avatar, identidad, extras);
    elementos.lista.append(fila);
  }
  elementos.resultadoTitulo.textContent = `${resultado.nodos.length} de ${resultado.total} catequizandos`;
}

function activarPasos(cantidad) {
  const pasos = [...elementos.recorrido.querySelectorAll('div')];
  pasos.forEach((paso, indice) => paso.classList.toggle('activo', indice < cantidad));
}

async function consultar(evento) {
  evento?.preventDefault();
  const boton = elementos.formConsulta.querySelector('button');
  const campos = [...document.querySelectorAll('input[name="campo"]:checked')].map((entrada) => entrada.value);
  if (campos.length === 0) {
    elementos.codigoRespuesta.textContent = 'Selecciona por lo menos un campo.';
    return;
  }
  boton.disabled = true;
  try {
    const query = consultaCatequizandos(campos, elementos.limite.value);
    const { datos, duracion } = await ejecutarGraphql(query, { grupoId: elementos.grupoId.value });
    renderizarPersonas(datos.catequizandos, campos);
    elementos.duracionConsulta.textContent = `${duracion} ms`;
  } catch (error) {
    elementos.lista.className = 'lista-vacia';
    elementos.lista.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
}

async function registrarAsistencia(evento) {
  evento.preventDefault();
  const boton = elementos.formMutacion.querySelector('button');
  boton.disabled = true;
  activarPasos(1);
  elementos.mensajeMutacion.className = 'mensaje-neutro';
  elementos.mensajeMutacion.textContent = 'Enviando mutación al endpoint GraphQL…';
  const id = crypto.randomUUID();
  const query = `mutation Registrar($entrada: RegistrarAsistenciaEntrada!) {
  registrarAsistencia(entrada: $entrada) {
    id
    repetido
  }
}`;
  const variables = {
    entrada: {
      id,
      catequizandoId: elementos.catequizandoId.value,
      fecha: elementos.fecha.value,
      estado: elementos.estado.value,
    },
  };
  try {
    const escritura = await ejecutarGraphql(query, variables);
    activarPasos(3);
    elementos.mensajeMutacion.textContent = 'Escritura realizada. Confirmando el cambio con una nueva consulta…';

    const confirmacion = `query Confirmar($id: ID!, $fecha: FechaCivil!) {
  catequizando(id: $id) {
    identidadOperativa
    asistencias(desde: $fecha, hasta: $fecha) {
      id
      fecha
      estado
    }
  }
}`;
    const verificacion = await ejecutarGraphql(confirmacion, {
      id: elementos.catequizandoId.value,
      fecha: elementos.fecha.value,
    });
    const asistencia = verificacion.datos.catequizando.asistencias.find((item) => item.id === id);
    if (!asistencia) throw new Error('La consulta posterior no encontró el UUID registrado');
    activarPasos(4);
    elementos.mensajeMutacion.className = 'mensaje-exito';
    elementos.mensajeMutacion.textContent = `Confirmado: ${asistencia.estado} guardado con UUID ${id}`;
    elementos.codigoSolicitud.textContent = `${query}\n\nVariables:\n${JSON.stringify(variables, null, 2)}`;
    elementos.codigoRespuesta.textContent = JSON.stringify({
      mutacion: escritura.datos,
      consultaPosterior: verificacion.datos,
    }, null, 2);
    elementos.codigoEstado.textContent = 'mutación + confirmación';
  } catch (error) {
    elementos.mensajeMutacion.className = 'mensaje-error';
    elementos.mensajeMutacion.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
}

async function comprobarEstado() {
  try {
    const respuesta = await fetch('/api/estado');
    const estado = await respuesta.json();
    elementos.pulso.classList.add('activo');
    elementos.estadoTexto.textContent = 'GraphQL y gRPC activos';
    elementos.endpointTexto.textContent = `${estado.endpoint} · JWT en memoria`;
  } catch {
    elementos.estadoTexto.textContent = 'Servicios no disponibles';
    elementos.endpointTexto.textContent = 'Revisa la terminal de demo:web';
  }
}

elementos.limite.addEventListener('input', () => {
  elementos.limiteValor.textContent = elementos.limite.value;
});
elementos.formConsulta.addEventListener('submit', consultar);
elementos.formMutacion.addEventListener('submit', registrarAsistencia);
elementos.grupoId.value = GRUPO_DEMO;
comprobarEstado();
