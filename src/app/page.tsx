import Link from "next/link";

const accesos = [
  {
    href: "/asistencia",
    rol: "Catequista",
    titulo: "Pasar lista",
    detalle: "Funciona sin senal. Se envia solo cuando vuelve la conexion.",
  },
  {
    href: "/coordinacion",
    rol: "Coordinacion",
    titulo: "Panel del ciclo",
    detalle: "Asistencia por grupo, justificaciones y senales de riesgo.",
  },
  {
    href: "/familia",
    rol: "Familia",
    titulo: "Mi hijo o hija",
    detalle: "Asistencias del ciclo y envio de justificaciones.",
  },
];

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-blue-900">
          Parroquia
        </p>
        <h1 className="text-2xl font-semibold text-balance">
          Gestion de catequesis
        </h1>
        <p className="text-sm text-gray-600">
          Asistencia, justificaciones y seguimiento del ciclo, en el celular
          que ya usa el equipo.
        </p>
      </header>

      <nav className="flex flex-col gap-3">
        {accesos.map((acceso) => (
          <Link
            key={acceso.href}
            href={acceso.href}
            className="rounded-xl border border-gray-200 p-4 transition-colors hover:border-blue-900 hover:bg-blue-50"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-blue-900">
              {acceso.rol}
            </p>
            <p className="mt-1 font-medium">{acceso.titulo}</p>
            <p className="mt-1 text-sm text-gray-600">{acceso.detalle}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
