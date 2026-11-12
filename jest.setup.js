/**
 * Configuracion de Jest para el cliente.
 * NetInfo necesita su mock oficial: sin el modulo nativo no puede iniciar.
 */
/* global jest */

jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js")
);
