// Único archivo que cambia al pasar de local al APIM.
window.CONFIG = {
  CAT_BASE:  "http://localhost:3001",   // luego: https://<apim>.azure-api.net/cat
  ASIS_BASE: "http://localhost:3002",   // luego: https://<apim>.azure-api.net/asis
  API_KEY:   ""                         // cabecera Ocp-Apim-Subscription-Key (solo demo)
};
