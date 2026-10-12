"""OIDC, secretos persistentes en Key Vault y despliegue en dos fases; nunca imprime secretos."""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
from urllib.parse import quote


def azure(*argumentos):
    resultado = subprocess.run(
        ['az', *argumentos, '--only-show-errors', '--output', 'json'],
        capture_output=True, text=True, check=False,
    )
    if resultado.returncode:
        raise RuntimeError(f'Fallo de Azure CLI en {argumentos[0]}; revisar estado en Azure (salida sensible suprimida).')
    return json.loads(resultado.stdout) if resultado.stdout.strip() else None


def guardar_temporal(nombre, contenido):
    ruta = Path(os.environ['RUNNER_TEMP']) / nombre
    descriptor = os.open(ruta, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as archivo:
        archivo.write(contenido)
    return ruta


def guardar_secreto(boveda, nombre, valor):
    ruta = guardar_temporal('sigecat-secreto.txt', valor)
    try:
        azure('keyvault', 'secret', 'set', '--vault-name', boveda, '--name', nombre, '--file', str(ruta))
    finally:
        ruta.unlink(missing_ok=True)


def leer_secreto(boveda, nombre, crear=False):
    existentes = azure('keyvault', 'secret', 'list', '--vault-name', boveda)
    if any(item['name'] == nombre for item in existentes):
        return azure('keyvault', 'secret', 'show', '--vault-name', boveda, '--name', nombre)['value']
    if not crear:
        raise RuntimeError(f'Falta el secreto {nombre}; realizar primero el bootstrap autorizado.')
    valor = 'SgC9!' + secrets.token_urlsafe(48)
    guardar_secreto(boveda, nombre, valor)
    return valor


def exportar(nombre, valor):
    # Las credenciales recuperadas por OIDC no tienen el enmascaramiento automatico de GitHub secrets.
    if nombre.startswith('BD_') or nombre.startswith('SIGECAT_CLAVE'):
        print(f'::add-mask::{valor}', flush=True)
    with open(os.environ['GITHUB_ENV'], 'a') as archivo:
        archivo.write(f'{nombre}={valor}\n')


def informar_plan(resultado):
    for cambio in resultado.get('changes', []):
        print(f"{cambio['changeType']}: {cambio['resourceId']}")


def principal():
    analizador = argparse.ArgumentParser()
    analizador.add_argument('--activar-apim', action='store_true')
    analizador.add_argument('--limpiar', action='store_true')
    opciones = analizador.parse_args()
    if opciones.limpiar:
        for nombre in ['sigecat-parametros.json', 'sigecat-secreto.txt']:
            (Path(os.environ['RUNNER_TEMP']) / nombre).unlink(missing_ok=True)
        import shutil
        shutil.rmtree(Path(os.environ['RUNNER_TEMP']) / 'paquete-api', ignore_errors=True)
        return
    grupo = os.environ['GRUPO_RECURSOS']
    ruta_parametros = Path(os.environ['RUNNER_TEMP']) / 'sigecat-parametros.json'
    if opciones.activar_apim:
        boveda = os.environ['NOMBRE_BOVEDA']
        claves = azure('functionapp', 'keys', 'list', '--resource-group', grupo, '--name', os.environ['NOMBRE_FUNCIONES'])
        guardar_secreto(boveda, 'clave-host-funciones', claves['functionKeys']['default'])
        parametros = json.loads(ruta_parametros.read_text())
        parametros['parameters']['publicarPoliticas']['value'] = True
        guardar_temporal(ruta_parametros.name, json.dumps(parametros))
        azure('deployment', 'group', 'create', '--resource-group', grupo, '--name', 'sigecat-prod', '--template-file', 'infra/main.bicep', '--parameters', '@' + str(ruta_parametros))
        return

    solo_plan = os.environ.get('SOLO_PLAN', 'true') == 'true'
    configuracion = {
        'ubicacion': os.environ.get('UBICACION') or 'eastus2',
        'ubicacionWeb': os.environ.get('UBICACION_WEB') or 'eastus2',
        'prefijo': os.environ.get('PREFIJO') or 'sigecat',
        'correoPresupuesto': os.environ['CORREO_PRESUPUESTO'],
        'inicioPresupuesto': os.environ['INICIO_PRESUPUESTO'],
        'jwtKid': os.environ.get('JWT_KID') or 'prod-1',
        'jwtKidAnterior': os.environ.get('JWT_KID_ANTERIOR') or '',
        'publicarPoliticas': False,
    }
    if not configuracion['correoPresupuesto'] or not configuracion['inicioPresupuesto']:
        raise RuntimeError('CORREO_PRESUPUESTO e INICIO_PRESUPUESTO son obligatorios.')
    for kid in [configuracion['jwtKid'], configuracion['jwtKidAnterior']]:
        if kid and not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', kid):
            raise RuntimeError('kid invalido: usar letras, numeros, guion y guion bajo.')
    if not solo_plan:
        azure('group', 'create', '--name', grupo, '--location', configuracion['ubicacion'])
        bootstrap = azure('deployment', 'group', 'create', '--resource-group', grupo, '--name', 'sigecat-bootstrap', '--template-file', 'infra/bootstrap.bicep', '--parameters', f"ubicacion={configuracion['ubicacion']}", f"prefijo={configuracion['prefijo']}")
        boveda = bootstrap['properties']['outputs']['nombreBoveda']['value']
    else:
        bovedas = azure('keyvault', 'list', '--resource-group', grupo)
        if len(bovedas) != 1:
            raise RuntimeError('What-if requiere el grupo y una boveda existente; no crea recursos ni secretos.')
        boveda = bovedas[0]['name']
    # El principal OIDC necesita Secrets Officer en esta boveda, concedido por el responsable.
    clave_admin = leer_secreto(boveda, 'bd-clave-administracion', crear=not solo_plan)
    configuracion['claveAdministracion'] = clave_admin
    parametros = {'$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#', 'contentVersion': '1.0.0.0', 'parameters': {nombre: {'value': valor} for nombre, valor in configuracion.items()}}
    guardar_temporal(ruta_parametros.name, json.dumps(parametros))
    # What-if incluye politicas finales; un plan nunca modifica su estado ni recupera la clave de host.
    if solo_plan:
        parametros['parameters']['publicarPoliticas']['value'] = True
        guardar_temporal(ruta_parametros.name, json.dumps(parametros))
        informar_plan(azure('deployment', 'group', 'what-if', '--resource-group', grupo, '--template-file', 'infra/main.bicep', '--parameters', '@' + str(ruta_parametros), '--no-pretty-print'))
        print('What-if ejecutado; detalle de cambios disponible en la operacion Azure. Sin despliegue.')
        return
    informar_plan(azure('deployment', 'group', 'what-if', '--resource-group', grupo, '--template-file', 'infra/main.bicep', '--parameters', '@' + str(ruta_parametros), '--no-pretty-print'))
    resultado = azure('deployment', 'group', 'create', '--resource-group', grupo, '--name', 'sigecat-prod', '--template-file', 'infra/main.bicep', '--parameters', '@' + str(ruta_parametros))
    salidas = {nombre: item['value'] for nombre, item in resultado['properties']['outputs'].items()}
    for origen, destino in [('nombreBoveda', 'NOMBRE_BOVEDA'), ('nombreAlmacen', 'NOMBRE_ALMACEN'), ('nombrePostgres', 'NOMBRE_POSTGRES'), ('nombreFunciones', 'NOMBRE_FUNCIONES')]:
        exportar(destino, salidas[origen])
    clave_api = leer_secreto(boveda, 'bd-clave-api', crear=True)
    clave_migrador = leer_secreto(boveda, 'bd-clave-migrador', crear=True)
    clave_jwt = leer_secreto(boveda, 'jwt-clave', crear=True)
    leer_secreto(boveda, 'renovacion-clave', crear=True)
    guardar_secreto(boveda, 'jwt-clave-apim', base64.b64encode(clave_jwt.encode()).decode())
    claves_jwt = {configuracion['jwtKid']: clave_jwt}
    if configuracion['jwtKidAnterior']:
        if configuracion['jwtKidAnterior'] == configuracion['jwtKid']:
            raise RuntimeError('Los kid actual y anterior deben ser distintos.')
        anterior = leer_secreto(boveda, 'jwt-clave-anterior')
        claves_jwt[configuracion['jwtKidAnterior']] = anterior
        guardar_secreto(boveda, 'jwt-clave-anterior-apim', base64.b64encode(anterior.encode()).decode())
    guardar_secreto(boveda, 'jwt-claves', json.dumps(claves_jwt))
    guardar_secreto(boveda, 'jwt-kid', configuracion['jwtKid'])
    guardar_secreto(boveda, 'url-web', salidas['urlWeb'])
    def url_bd(rol, clave):
        return f"postgresql://{rol}:{quote(clave, safe='')}@{salidas['dominioPostgres']}:5432/sigecat?sslmode=verify-full"
    guardar_secreto(boveda, 'bd-url', url_bd('sigecat_api', clave_api))
    guardar_secreto(boveda, 'bd-url-migrador', url_bd('sigecat_migrador', clave_migrador))
    almacen = azure('storage', 'account', 'show', '--resource-group', grupo, '--name', salidas['nombreAlmacen'])
    claves = azure('storage', 'account', 'keys', 'list', '--resource-group', grupo, '--account-name', salidas['nombreAlmacen'])
    conexion = f"DefaultEndpointsProtocol=https;AccountName={salidas['nombreAlmacen']};AccountKey={claves[0]['value']};BlobEndpoint={almacen['primaryEndpoints']['blob']}"
    guardar_secreto(boveda, 'blobs-conexion', conexion)
    exportar('BD_ADMIN_URL', url_bd('administracion', clave_admin))
    exportar('BD_URL', url_bd('sigecat_migrador', clave_migrador))
    exportar('BD_API_CLAVE', clave_api)
    exportar('BD_MIGRADOR_CLAVE', clave_migrador)
    # Refrescar referencias: la app se creo antes de que los secretos existieran.
    sitio = azure('functionapp', 'show', '--resource-group', grupo, '--name', salidas['nombreFunciones'])
    azure('rest', '--method', 'post', '--uri', f"https://management.azure.com{sitio['id']}/config/configreferences/appsettings/refresh?api-version=2022-03-01")
    print('Infraestructura creada; migracion y publicacion pendientes de los siguientes pasos.')


if __name__ == '__main__':
    try:
        principal()
    except (RuntimeError, KeyError) as error:
        raise SystemExit(str(error)) from None
