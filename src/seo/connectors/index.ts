import type { PlatformConnector } from "./types";
import { genericWebConnector } from "./generic-web";
import { tiendanubeConnector } from "./tiendanube";
import { mercadolibreConnector } from "./mercadolibre";

/** Registro de conectores. Agregar WordPress/WooCommerce/Shopify = agregar aquí. */
export const CONNECTORS: PlatformConnector[] = [
  genericWebConnector,
  tiendanubeConnector,
  mercadolibreConnector,
];

export function getConnector(id: string): PlatformConnector | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

export * from "./types";
