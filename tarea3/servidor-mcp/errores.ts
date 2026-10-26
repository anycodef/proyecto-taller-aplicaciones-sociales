export class ErrorHerramienta extends Error {
  constructor(readonly codigo: "fuera_de_alcance" | "error_interno") {
    super(codigo);
    this.name = "ErrorHerramienta";
  }
}
