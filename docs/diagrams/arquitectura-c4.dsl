# Version 1.0.0
workspace "SIGECAT" "Diagrama de Contexto del Sistema (Nivel 1 - C1)" {

    model {
        # Personas / Actores
        catequista = person "Catequista" "Registra asistencia rápida (misa y catequesis), evalúa oraciones y doctrina, y consulta fichas de niños." "Usuario"
        coordinador = person "Coordinador (a)" "Administra ciclos, grupos, inscripciones, auditoría de asistencia y monitorea alertas de deserción." "Usuario"
        parroco = person "Párroco (Auditor)" "Supervisa la aptitud sacramental, retención y revisa la evidencia verificable de asistencia." "Usuario"
        padreTutor = person "Padres" "Envía justificaciones de faltas con fotos y consulta el avance sacramental del catequizando." "Usuario"

        # Sistema Principal
        sistemaCatequesis = softwareSystem "SIGECAT: Sistema Integrado de Gestión y Seguimiento Catequético Parroquial" "Plataforma central para gestionar inscripciones, control de asistencia y avance sacramental" "SistemaPrincipal" {
            ## Contenedores
            appMovil = container "Aplicación móvil SIGECAT" "Interfaz móvil para toma rápida de asistencia dominical, consulta de documentación, seguimiento de progreso de los niños y envío de justificaciones." "React Native & Expo" "ContenedorFrontend" {
                cmpUI = component "Interfaz y Navegación" "Pantallas táctiles, formularios rápidos y enrutamiento por pestañas según el rol." "React Navigation & UI Components" "ComponenteUI"
                cmpSesion = component "Gestión de Sesión" "Controla el ciclo de vida del login, almacenamiento seguro de tokens y roles locales." "Expo SecureStore" "ComponenteCore"
                cmpNet = component "Monitor de Conectividad" "Detecta el estado de conexión de red y notifica eventos online/offline." "NetInfo API" "ComponenteCore"
                cmpAsistencia = component "Registro de Asistencia" "Lógica de escaneo/marcado rápido de asistencia dominical (misa y catequesis)." "Controlador TypeScript" "ComponenteNegocio"
                cmpCatequizandos = component "Gestión de Catequizandos" "Administración de fichas individuales, salud, neurodivergencia y documentos." "Controlador TypeScript" "ComponenteNegocio"
                cmpSeguimiento = component "Seguimiento Formativo" "Registro del avance en memorización de oraciones, doctrina y jornadas." "Controlador TypeScript" "ComponenteNegocio"
                cmpJustificaciones = component "Gestión de Justificaciones" "Recepción de justificaciones familiares y compresión de evidencias fotográficas." "Controlador TypeScript & ImagePicker" "ComponenteNegocio"
                cmpSync = component "Gestión de Sincronización" "Orquesta la resolución de conflictos y envío diferido en lotes hacia el backend." "WatermelonDB Sync Engine" "ComponenteSync"
                cmpRepoLocal = component "Repositorio Local" "Abstracción ORM para consultas y transacciones reactivas en almacenamiento local." "WatermelonDB Database" "ComponenteDatos"
                cmpClienteAPI = component "Cliente API" "Cliente API para comunicarse con el Backend" "None" "ComponenteCore"

                # Relaciones internas del contenedor móvil
                cmpUI -> cmpSesion "Verifica credenciales y permisos"
                cmpUI -> cmpAsistencia "Invoca registro rápido"
                cmpUI -> cmpCatequizandos "Consulta y actualiza fichas"
                cmpUI -> cmpSeguimiento "Registra oraciones y doctrina"
                cmpUI -> cmpJustificaciones "Carga evidencias y justificantes"

                cmpAsistencia -> cmpRepoLocal "Escribe asistencias en offline"
                cmpCatequizandos -> cmpRepoLocal "Consulta y persiste datos de niños"
                cmpSeguimiento -> cmpRepoLocal "Actualiza progreso de oraciones"
                cmpJustificaciones -> cmpRepoLocal "Almacena justificante temporal"

                cmpSync -> cmpNet "Escucha cambios de conectividad"
                cmpSync -> cmpRepoLocal "Lee cambios pendientes y aplica deltas remotos"
            }
            
            apiBackend = container "Backend / API Serverless" "Punto de entrada API, orquestador de reglas de negocio, cálculo de riesgo de deserción y compresión de archivos." "None" "ContenedorBackend" {
                cmpController = component "API Controller" "Enruta solicitudes HTTP, valida esquemas de entrada y serializa respuestas REST/JSON." "REST Router / Express / Oak" "C3BackCore"
                cmpSeguridad = component "Seguridad y Control de Acceso" "Valida firmas JWT, aplica RBAC y anonimiza catequistas menores de edad." "Auth Middleware" "C3BackSeguridad"
                cmpSyncSvc = component "Servicio de Sincronización" "Procesa inserciones por lotes, resuelve colisiones y emite deltas para WatermelonDB." "Sync Protocol Handler" "C3BackNegocio"
                cmpInscripciones = component "Gestión de Inscripciones y Documentos" "Procesa fichas, partidas de bautismo, DNIs y orquesta la carga al almacenamiento." "Business Service" "C3BackNegocio"
                cmpCatequizandosBack = component "Gestión de Catequizandos" "Administra perfiles consolidados, salud, neurodivergencia y asignación de grupos." "Business Service" "C3BackNegocio"
                cmpAsistenciaSvc = component "Gestión de Asistencia" "Audita presencia en misa y catequesis, y alimenta el detector de deserción." "Business Service" "C3BackNegocio"
                cmpJustificacionesSvc = component "Gestión de Justificaciones" "Vincula justificaciones y fotos directamente a la ficha del niño sin usar WhatsApp." "Business Service" "C3BackNegocio"
                cmpSeguimientoSvc = component "Seguimiento Formativo" "Registra el progreso en memorización de las 10 oraciones y contenidos doctrinales." "Business Service" "C3BackNegocio"
                cmpActividades = component "Gestión de Actividades Obligatorias" "Registra asistencia y firmas de jornadas, viacrucis, retiros y Semana Santa." "Business Service" "C3BackNegocio"
                cmpSacramental = component "Evaluación Sacramental" "Consolida las 3 dimensiones (misa, doctrina, oraciones) para determinar la aptitud." "Analytics & Rules Engine" "C3BackNegocio"

                # Relaciones internas del Backend
                cmpController -> cmpSeguridad "Intercepta peticiones para autenticación y autorización"
                cmpController -> cmpSyncSvc "Delega payloads de sincronización diferida"
                cmpController -> cmpInscripciones "Delega registro de inscripciones y carga documental"
                cmpController -> cmpCatequizandosBack "Delega consultas y actualizaciones de fichas"
                cmpController -> cmpAsistenciaSvc "Delega registro y consulta de asistencia"
                cmpController -> cmpJustificacionesSvc "Delega procesamiento de justificaciones"
                cmpController -> cmpSeguimientoSvc "Delega avance de oraciones y doctrina"
                cmpController -> cmpActividades "Delega registro de participación en eventos"
                cmpController -> cmpSacramental "Consulta dictamen de aptitud y reportes de deserción"

                cmpSyncSvc -> cmpAsistenciaSvc "Aplica registros de asistencia tomados offline"
                cmpSyncSvc -> cmpSeguimientoSvc "Aplica evaluaciones de oraciones offline"
                cmpSacramental -> cmpAsistenciaSvc "Evalúa porcentaje de asistencia a misa"
                cmpSacramental -> cmpSeguimientoSvc "Evalúa oraciones aprobadas y doctrina"
                cmpSacramental -> cmpActividades "Verifica cumplimiento de jornadas y retiros"
            }
            
            sqliteLocal = container "Base de Datos Local" "Almacenamiento embebido en el dispositivo para soporte offline-first y sincronización diferida." "SQLite & WatermelonDB" "ContenedorBD"
            
            dbRelacional = container "Base de Datos SIGECAT" "Persistencia relacional de perfiles, asistencias y aprendizaje de oraciones" "PostgreSQL" "ContenedorBD"
    
            ## Relaciones internas de contenedores
            appMovil -> sqliteLocal "Lee y escribe datos localmente sin conexión" "WatermelonDB SDK"
            appMovil -> apiBackend "Consulta y actualiza información" "JSON/HTTPS"
            apiBackend -> dbRelacional "Consulta y actualiza información institucional" "SQL"

            ## Componentes <-> Contenedores
            cmpRepoLocal -> sqliteLocal "Lee y escribe registros locales" "SQLite Driver"
            cmpSesion -> cmpClienteAPI "Autentica credenciales" "JSON/HTTPS"
            cmpSync -> cmpClienteAPI "Sube mutaciones y baja sincronización incremental" "JSON/HTTPS"
            cmpClienteAPI -> apiBackend "Comunicaca acciones al backend" "JSON/HTTPS"
            
            appMovil -> cmpController "Consume APIs y envía deltas" "HTTPS/JSON"


        }

        # Sistemas Externos
        servicioAuth = softwareSystem "Servicio de Autenticación / Correo" "Gestiona la identidad de usuarios, emisión de tokens y control de acceso basado en roles (RBAC)." "SistemaExterno"
        servicioStorage = softwareSystem "Servicio de Almacenamiento" "Repositorio en la nube para documentos escaneados y evidencias fotográficas de justificaciones." "SistemaExterno"

        # Relaciones

        ## Usuarios <-> Sistema
        catequista -> sistemaCatequesis "Registra asistencia"
        coordinador -> sistemaCatequesis "Administra sistema y hace seguimiento"
        parroco -> sistemaCatequesis "Consulta seguimiento y evidencias"
        padreTutor -> sistemaCatequesis "Envía justificaciones y documentación"

        ## Sistema <-> Servicios
        sistemaCatequesis -> servicioAuth "Delega la autenticación y resolución de roles" "HTTPS"
        sistemaCatequesis -> servicioStorage "Almacena y recupera fotos y documentos" "HTTPS"
        
        ## Usuarios <-> Contenedores
        catequista -> appMovil "Registra asistencia y evalúa aprendizaje de oraciones"
        coordinador -> appMovil "Monitorea grupos y alertas de deserción temprana"
        parroco -> appMovil "Supervisa reportes y auditoría de asistencias"
        padreTutor -> appMovil "Registra justificaciones y evidencias"

        ## Contenedores <-> Servicios   
        apiBackend -> servicioAuth "Valida usuario y gesiona comunicaciones" "HTTPS"
        apiBackend -> servicioStorage "Almacena y recupera documentos y evidencias" "HTTPS"

        cmpSeguridad -> servicioAuth "Verifica tokens JWT y políticas RBAC" "HTTPS"
        cmpInscripciones -> servicioStorage "Guarda partidas, DNIs y boletas" "HTTPS / S3 API"
        cmpJustificacionesSvc -> servicioStorage "Guarda fotos de evidencias de justificación" "HTTPS / S3 API"

        ## Usuarion <-> Componentes
        catequista -> cmpUI "Interactúa para registrar asistencia y progreso"
        coordinador -> cmpUI "Consulta dashboards y gestiona grupos"
        parroco -> cmpUI "Audita asistencias y evidencias"
        padreTutor -> cmpUI "Ingresa justificaciones y fotos"

        cmpSyncSvc -> dbRelacional "Aplica mutaciones en lote" "SQL"
        cmpInscripciones -> dbRelacional "Inserta y consulta inscripciones" "SQL"
        cmpCatequizandosBack -> dbRelacional "Consulta y actualiza fichas de salud/perfil" "SQL"
        cmpAsistenciaSvc -> dbRelacional "Persiste asistencias y faltas" "SQL"
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

        component apiBackend "DiagramaComponentesC3_Backend" "Diagrama de Componentes (C3) del Backend / API Serverless" {
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