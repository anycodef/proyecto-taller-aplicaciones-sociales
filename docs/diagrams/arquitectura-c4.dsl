# Version 1.2.0 - acuerdos backend 001-003; arquitectura objetivo, no evidencia de implementacion
workspace "SIGECAT" "Diagrama de Contexto, Contenedores y Componentes" {

    model {
        # Personas / Actores
        catequista = person "Catequista" "Registra asistencia rápida (misa y catequesis), evalúa oraciones y doctrina, y consulta fichas de niños." "Usuario"
        coordinador = person "Coordinador (a)" "Administra ciclos, grupos, inscripciones, auditoría de asistencia y monitorea alertas de deserción." "Usuario"
        parroco = person "Párroco (Auditor)" "Supervisa la aptitud sacramental, retención y revisa la evidencia verificable de asistencia." "Usuario"
        padreTutor = person "Padres" "Envía justificaciones de faltas con fotos y consulta el avance sacramental del catequizando." "Usuario"
        admin = person "Administrador del Sistema" "Gestiona usuarios, roles y permisos de acceso al sistema." "Usuario"

        # Sistema Principal
        sistemaCatequesis = softwareSystem "SIGECAT: Sistema Integrado de Gestión y Seguimiento Catequético Parroquial" "Plataforma central para gestionar inscripciones, control de asistencia y avance sacramental" "SistemaPrincipal" {
            
            ## Contenedores
            appMovil = container "Aplicación móvil SIGECAT" "Interfaz móvil para toma rápida de asistencia dominical, consulta de documentación, seguimiento de progreso y envío de justificaciones." "React Native & Expo" "ContenedorFrontend" {
                cmpUI = component "Interfaz y Navegación" "Pantallas táctiles, formularios rápidos y enrutamiento por pestañas según el rol." "React Navigation & UI Components" "ComponenteUI"
                cmpSesion = component "Gestión de Sesión" "Activa enlace, verifica PIN exclusivamente local y protege credencial en SecureStore; renueva antes del push." "Expo SecureStore" "ComponenteCore"
                cmpNet = component "Monitor de Conectividad" "Detecta el estado de conexión de red y notifica eventos online/offline." "NetInfo API" "ComponenteCore"
                cmpAsistencia = component "Registro de Asistencia" "Lógica de escaneo/marcado rápido de asistencia dominical (misa y catequesis)." "Controlador TypeScript" "ComponenteNegocio"
                cmpCatequizandos = component "Gestión de Catequizandos" "Nómina operativa local; inscripción, condiciones y estados documentales exclusivamente ONLINE, sin copias ni persistencia local." "Controlador TypeScript" "ComponenteNegocio"
                cmpSeguimiento = component "Seguimiento Formativo" "Registro del avance en memorización de oraciones, doctrina y jornadas." "Controlador TypeScript" "ComponenteNegocio"
                cmpJustificaciones = component "Gestión de Justificaciones" "Recepción de justificaciones familiares y compresión de evidencias fotográficas." "Controlador TypeScript & ImagePicker" "ComponenteNegocio"
                cmpSync = component "Gestión de Sincronización" "Orquesta la resolución de conflictos y envío diferido en lotes hacia el backend." "WatermelonDB Sync Engine" "ComponenteSync"
                cmpRepoLocal = component "Repositorio Local" "Abstracción ORM para consultas y transacciones reactivas en almacenamiento local." "WatermelonDB Database" "ComponenteDatos"
                cmpClienteAPI = component "Cliente API" "Cliente HTTP local para comunicarse con las funciones del backend cuando hay red." "Axios / Fetch Client" "ComponenteCore"

                # Relaciones internas del contenedor móvil
                cmpUI -> cmpSesion "Verifica credenciales y permisos"
                cmpUI -> cmpAsistencia "Invoca registro rápido"
                cmpUI -> cmpCatequizandos "Consulta y actualiza fichas"
                cmpUI -> cmpSeguimiento "Registra oraciones y doctrina"
                cmpUI -> cmpJustificaciones "Carga evidencias y justificantes"

                cmpAsistencia -> cmpRepoLocal "Escribe asistencias en offline"
                cmpCatequizandos -> cmpRepoLocal "Lee nómina mínima y grupos sincronizados; nunca condiciones/documentos/apoderados"
                cmpCatequizandos -> cmpClienteAPI "Administra perfiles, inscripción y estados solo ONLINE; borrador en memoria"
                cmpSeguimiento -> cmpRepoLocal "Actualiza progreso de oraciones"
                cmpJustificaciones -> cmpClienteAPI "Envía evidencia solo con conexión; nunca persiste evidencia local"

                cmpSync -> cmpNet "Escucha cambios de conectividad"
                cmpSync -> cmpRepoLocal "Lee cambios pendientes y aplica deltas remotos"
                cmpSync -> cmpClienteAPI "Envía lotes de sincronización"
                cmpSesion -> cmpClienteAPI "Canjea enlace y renueva token; nunca envía PIN ni contraseña"
            }
            
            apiBackend = container "Backend / API Serverless" "Azure Flex detrás de APIM; pool3/proceso, worker1, max5/grupo, HTTP10, 2048MB, always-ready0; timers UTC." "Azure Functions v4 (Node.js 22) / APIM" "ContenedorBackend" {
                cmpController = component "API Controller / HTTP Triggers" "Endpoints HTTP (app.http en v4), valida esquemas de entrada y serializa respuestas JSON." "Azure Functions HTTP Trigger" "C3BackCore"
                cmpSeguridad = component "Seguridad y Autenticación Interna" "Canjea enlaces por JWT, almacena hashes de tokens (no PIN/contraseñas), revalida roles/alcance, audita y coordina retención por participantes." "Node.js Crypto / jose / PostgreSQL" "C3BackSeguridad"
                cmpSyncSvc = component "Servicio de Sincronización" "Procesa inserciones por lotes, resuelve colisiones y emite deltas para WatermelonDB." "Sync Protocol Handler" "C3BackNegocio"
                cmpInscripciones = component "Gestión de Inscripciones y Documentos" "Inscripción y consentimiento atómicos ONLINE; solo estados documentales RF-204, sin imágenes, copias, DNI ni carga a Blob." "Business Service" "C3BackNegocio"
                cmpCatequizandosBack = component "Gestión de Catequizandos" "Administra perfiles consolidados, salud, neurodivergencia y asignación de grupos." "Business Service" "C3BackNegocio"
                cmpAsistenciaSvc = component "Gestión de Asistencia" "Audita presencia en misa y catequesis, y alimenta el detector de deserción." "Business Service" "C3BackNegocio"
                cmpJustificacionesSvc = component "Gestión de Justificaciones" "Objetivo spec 004: justificaciones/evidencias ONLINE; integración por puertos, módulo externo no declarado completo." "Business Service" "C3BackNegocio"
                cmpSeguimientoSvc = component "Seguimiento Formativo" "Objetivo spec 005: oraciones/doctrina; puertos de integración, módulo externo no declarado completo." "Business Service" "C3BackNegocio"
                cmpActividades = component "Gestión de Actividades Obligatorias" "Registra asistencia y firmas de jornadas, viacrucis, retiros y Semana Santa." "Business Service" "C3BackNegocio"
                cmpSacramental = component "Evaluación Sacramental" "Consolida las 3 dimensiones (misa, doctrina, oraciones) para determinar la aptitud." "Analytics & Rules Engine" "C3BackNegocio"

                # Relaciones internas del Backend
                cmpController -> cmpSeguridad "Valida credenciales, genera tokens e intercepta peticiones"
                cmpController -> cmpSyncSvc "Delega payloads de sincronización diferida"
                cmpController -> cmpInscripciones "Delega inscripción ONLINE y estados documentales; sin upload"
                cmpController -> cmpCatequizandosBack "Delega consultas y actualizaciones de fichas"
                cmpController -> cmpAsistenciaSvc "Delega registro y consulta de asistencia"
                cmpController -> cmpJustificacionesSvc "Delega procesamiento de justificaciones"
                cmpController -> cmpSeguimientoSvc "Delega avance de oraciones y doctrina"
                cmpController -> cmpActividades "Delega registro de participación en eventos"
                cmpController -> cmpSacramental "Consulta dictamen de aptitud y reportes de deserción"

                cmpSyncSvc -> cmpAsistenciaSvc "Aplica registros de asistencia tomados offline"
                cmpAsistenciaSvc -> cmpCatequizandosBack "Consulta FuenteInscripciones histórica y carné SGC1; aporta resumenAsistencia"
                cmpSeguridad -> cmpCatequizandosBack "Retención: borra condiciones/estados/historial; anonimiza perfil y apoderado sin otros hijos"
                cmpSeguridad -> cmpAsistenciaSvc "Retención con rol y contexto SET LOCAL; conserva asistencia anonimizada"
                cmpSyncSvc -> cmpSeguimientoSvc "Aplica evaluaciones de oraciones offline"
                cmpSacramental -> cmpAsistenciaSvc "Evalúa porcentaje de asistencia a misa"
                cmpSacramental -> cmpSeguimientoSvc "Evalúa oraciones aprobadas y doctrina"
                cmpSacramental -> cmpActividades "Verifica cumplimiento de jornadas y retiros"
            }
            
            sqliteLocal = container "Base de Datos Local" "Almacenamiento embebido en el dispositivo para soporte offline-first y sincronización diferida." "SQLite & WatermelonDB" "ContenedorBD"
            
            dbRelacional = container "Base de Datos SIGECAT" "Tablas singulares snake_case; credenciales, perfiles, marcas inmutables, consolidado y contador atómico de límites por cuenta" "PostgreSQL Flexible 16" "ContenedorBD"
    
            ## Relaciones internas de contenedores
            appMovil -> sqliteLocal "Lee y escribe datos localmente sin conexión" "WatermelonDB SDK"
            appMovil -> apiBackend "Consulta y sincroniza información" "HTTPS/JSON"
            apiBackend -> dbRelacional "Consulta y actualiza información institucional" "SQL / TCP"

            ## Componentes <-> Contenedores
            cmpRepoLocal -> sqliteLocal "Lee y escribe registros locales" "SQLite Driver"
            cmpClienteAPI -> cmpController "Envía peticiones HTTP e intercambia deltas" "HTTPS/JSON"
        }

        # Sistema Externo (Solo Almacenamiento de Archivos)
        servicioStorage = softwareSystem "Azure Blob Storage" "Contenedor privado para evidencias autorizadas de justificaciones (004) y bandeja de borrado de retención; prohibidas copias de inscripción RF-204." "SistemaExterno"

        # Relaciones

        ## Usuarios <-> Sistema
        catequista -> sistemaCatequesis "Registra asistencia"
        coordinador -> sistemaCatequesis "Administra sistema y hace seguimiento"
        parroco -> sistemaCatequesis "Consulta seguimiento y evidencias"
        padreTutor -> sistemaCatequesis "Consulta estados documentales y envía justificaciones autorizadas"
        admin -> sistemaCatequesis "Gestiona usuarios, roles y permisos"

        ## Sistema <-> Servicios Externos
        sistemaCatequesis -> servicioStorage "Evidencias 004 autorizadas y borrado de retención; no copias de inscripción" "HTTPS"
        
        ## Usuarios <-> Contenedores
        catequista -> appMovil "Registra asistencia y evalúa aprendizaje de oraciones"
        coordinador -> appMovil "Monitorea grupos y alertas de deserción temprana"
        parroco -> appMovil "Supervisa reportes y auditoría de asistencias"
        padreTutor -> appMovil "Registra justificaciones y evidencias"
        admin -> appMovil "Gestiona usuarios y permisos"
        
        ## Contenedores <-> Servicios Externos   
        apiBackend -> servicioStorage "Gestiona evidencias autorizadas y borrado; no documentos de inscripción" "HTTPS"

        ## Componentes <-> Servicios Externos
        cmpSeguridad -> servicioStorage "Borra blobs tras commit con bandeja idempotente y reintentos" "HTTPS / Blob API"
        cmpJustificacionesSvc -> servicioStorage "Guarda fotos de evidencias de justificación" "HTTPS / Blob API"

        ## Usuarios <-> Componentes
        catequista -> cmpUI "Interactúa para registrar asistencia y progreso"
        coordinador -> cmpUI "Consulta dashboards y gestiona grupos"
        parroco -> cmpUI "Audita asistencias y evidencias"
        padreTutor -> cmpUI "Ingresa justificaciones y fotos"
        admin -> cmpUI "Gestiona usuarios y permisos"

        ## Componentes Backend <-> Base de Datos Central
        cmpSeguridad -> dbRelacional "Consulta y valida credenciales / roles (RBAC)" "SQL"
        cmpSyncSvc -> dbRelacional "Aplica mutaciones en lote" "SQL"
        cmpInscripciones -> dbRelacional "Inserta y consulta inscripciones" "SQL"
        cmpCatequizandosBack -> dbRelacional "Consulta y actualiza fichas de salud/perfil" "SQL"
        cmpAsistenciaSvc -> dbRelacional "Persiste marcas/consolidado/eventos; ausencias y faltas calculadas" "SQL"
        cmpJustificacionesSvc -> dbRelacional "Persiste justificaciones vinculadas al niño" "SQL"
        cmpSeguimientoSvc -> dbRelacional "Actualiza estado de oraciones y doctrina" "SQL"
        cmpActividades -> dbRelacional "Registra firmas de eventos obligatorios" "SQL"
        cmpSacramental -> dbRelacional "Calcula métricas y guarda aptitud sacramental" "SQL"
    }

    views {
        systemContext sistemaCatequesis "DiagramaContextoC1" "Diagrama de Contexto (C1) del Sistema de Gestión de Catequesis" {
            include *
            autoLayout lr
        }
        
        container sistemaCatequesis "DiagramaContenedoresC2" "Diagrama de Contenedores (C2) del Sistema de Gestión de Catequesis" {
            include *
            autoLayout lr
        }

        component appMovil "DiagramaComponentesC3_Movil" "Diagrama de Componentes (C3) de la Aplicación Móvil SIGECAT" {
            include *
            autoLayout lr
        }

        component apiBackend "DiagramaComponentesC3_Backend" "Diagrama de Componentes (C3) del Backend en Azure Functions v4" {
            include *
            autoLayout lr
        }

        styles {
            # Elemento base con fondo blanco obligatorio
            element "Element" {
                background "#ffffff"
                strokeWidth 7
            }

            # Usuarios: Borde Azul
            element "Usuario" {
                shape Person
                stroke "#0d6efd"
                color "#0d6efd"
            }

            # Sistema Principal: Borde Verde
            element "SistemaPrincipal" {
                shape RoundedBox
                stroke "#198754"
                color "#198754"
            }

            # Sistemas Externos: Borde Púrpura / Morado
            element "SistemaExterno" {
                shape RoundedBox
                stroke "#6f42c1"
                color "#6f42c1"
            }

            # Relaciones
            relationship "Relationship" {
                color "#495057"
            }
            
            # Contenedores Frontend: Borde Naranja
            element "ContenedorFrontend" {
                shape WebBrowser
                stroke "#fd7e14"
                color "#fd7e14"
            }
        
            # Contenedores Backend / Lógica: Borde Cian / Turquesa
            element "ContenedorBackend" {
                shape Box
                stroke "#0dcaf0"
                color "#0dcaf0"
            }
        
            # Contenedores de Persistencia / Bases de Datos: Borde Ámbar / Dorado
            element "ContenedorBD" {
                shape Cylinder
                stroke "#ffc107"
                color "#ffc107"
            }

            # Componentes UI: Borde Índigo
            element "ComponenteUI" {
                shape WebBrowser
                stroke "#6610f2"
                color "#6610f2"
            }

            # Componentes de Lógica de Negocio: Borde Verde Azulado
            element "ComponenteNegocio" {
                shape Component
                stroke "#20c997"
                color "#20c997"
            }

            # Componentes de Infraestructura / Core: Borde Gris Oscuro
            element "ComponenteCore" {
                shape Component
                stroke "#495057"
                color "#495057"
            }

            # Componente de Sincronización: Borde Naranja
            element "ComponenteSync" {
                shape Component
                stroke "#fd7e14"
                color "#fd7e14"
            }

            # Componente de Acceso a Datos: Borde Ámbar
            element "ComponenteDatos" {
                shape Component
                stroke "#ffc107"
                color "#ffc107"
            }

            # Componente Gateway / Core API: Borde Turquesa
            element "C3BackCore" {
                shape Component
                stroke "#0dcaf0"
                color "#0dcaf0"
            }

            # Componente de Seguridad / Auth Middleware: Borde Rojo Suave
            element "C3BackSeguridad" {
                shape Component
                stroke "#dc3545"
                color "#dc3545"
            }

            # Componentes de Lógica de Negocio y Reglas: Borde Verde Azulado
            element "C3BackNegocio" {
                shape Component
                stroke "#20c997"
                color "#20c997"
            }
        }
    }

}
