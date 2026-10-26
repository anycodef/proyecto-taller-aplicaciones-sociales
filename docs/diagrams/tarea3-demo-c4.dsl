# Supuesto de P1: P2, P3, P4 y P5 implementan los contratos congelados de
# tarea3/contratos/. Este diagrama describe la arquitectura esperada de la demo,
# no evidencia de implementacion ni un despliegue de produccion.
workspace "SIGECAT Tarea 3" "Demo pedagogica de GraphQL, gRPC y MCP con datos ficticios" {

    model {
        operador = person "Operador de la demo" "Ejecuta el comando, observa los pasos y revisa la salida." "Usuario"
        agente = softwareSystem "Agente de IA" "Cliente externo (Claude Code u otro) que descubre herramientas MCP y responde preguntas." "Externo"

        demo = softwareSystem "Demo Tarea 3" "Proyeccion minima de SIGECAT en el esquema demo_tarea3; no toca src/, api/ ni el modelo de produccion." "Demo" {
            orquestador = container "Orquestador de la demo" "Migra, siembra, arranca los servicios y ejecuta el recorrido; un solo comando." "Node.js 22 / tsx" "ContenedorDemo"
            mcp = container "Servidor MCP" "Expone herramientas acotadas por stdio; valida entradas y aplica alcance; no borra ni devuelve datos protegidos." "Node.js 22 / @modelcontextprotocol/sdk" "ContenedorDemo"
            graphql = container "Servicio de consulta" "Borde GraphQL de lectura; limita profundidad a 6 y pagina a 50; las mutaciones delegan en gRPC." "Node.js 22 / graphql-http" "ContenedorDemo"
            grpc = container "Servicio de actualizacion" "Escritura idempotente, lote dominical y streaming de asistencia." "Node.js 22 / @grpc/grpc-js" "ContenedorDemo"
            bd = container "PostgreSQL demo_tarea3" "Grupo, catequizando, asistencia, justificacion y riesgo; datos ficticios y borrables." "PostgreSQL 16" "ContenedorDemo"
            cliente = container "Cliente de prueba" "Cliente Node/Postman para el recorrido GraphQL y la prueba de streaming gRPC." "Node.js / fetch" "ContenedorDemo"

            operador -> demo "Ejecuta y observa" "terminal"
            agente -> mcp "Descubre y llama herramientas" "JSON-RPC sobre stdio"
            cliente -> graphql "Consulta el panel" "GraphQL/HTTP"
            cliente -> grpc "Prueba ObservarAsistencia" "gRPC"
            mcp -> graphql "Consulta riesgo y ficha" "GraphQL/HTTP"
            graphql -> grpc "Delega mutaciones" "gRPC"
            graphql -> bd "Lee grupo, ficha y riesgo" "SQL"
            grpc -> bd "Escribe asistencia, justificacion y riesgo" "SQL"
            orquestador -> bd "Migra y siembra" "SQL"
            orquestador -> graphql "Arranca el servicio" "child process"
            orquestador -> grpc "Arranca el servicio" "child process"
            orquestador -> mcp "Arranca el servicio" "child process"
        }
    }

    views {
        container demo "ContenedoresDemoTarea3" "C4 - Contenedores de la demo (arquitectura supuesta)" {
            include *
            autoLayout lr
        }

        # Secuencia de solo peticiones: las respuestas se muestran en el diagrama
        # Mermaid del informe para no duplicar relaciones en el modelo.
        dynamic demo "SecuenciaConsultaRiesgoMCP" "Secuencia - consulta de riesgo por MCP" {
            agente -> mcp "1. tools/call listar_riesgo_grupo"
            mcp -> graphql "2. query riesgoDelGrupo + catequizando"
            graphql -> bd "3. SELECT riesgo por grupo"
        }

        dynamic demo "SecuenciaEscrituraYStreaming" "Secuencia - escritura y streaming" {
            agente -> mcp "1. tools/call registrar_asistencia"
            mcp -> graphql "2. mutation registrarAsistencia"
            graphql -> grpc "3. RegistrarAsistencia"
            grpc -> bd "4. INSERT ... ON CONFLICT"
            cliente -> grpc "5. ObservarAsistencia (server streaming)"
        }

        styles {
            element "Element" {
                background "#ffffff"
                strokeWidth 7
            }
            element "Usuario" {
                shape Person
                stroke "#0d6efd"
                color "#0d6efd"
            }
            element "Demo" {
                stroke "#198754"
                color "#198754"
            }
            element "ContenedorDemo" {
                stroke "#6c757d"
                color "#212529"
            }
            element "Externo" {
                stroke "#fd7e14"
                color "#fd7e14"
            }
        }
    }
}
