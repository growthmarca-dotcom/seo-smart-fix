import type { PageSnapshot, PlatformId } from "../types";

export type ConnectorStatus = "available" | "planned" | "needs-credentials";

/** Campos que un conector declara poder leer y/o escribir. */
export interface FieldCapability {
  field: string;
  label: string;
  read: boolean;
  write: boolean;
  note?: string;
}

/**
 * Contrato único de todos los conectores. Cualquier plataforma que
 * implemente esta interfaz alimenta al mismo Audit Engine.
 */
export interface PlatformConnector {
  id: PlatformId;
  name: string;
  description: string;
  status: ConnectorStatus;
  /** Cómo se autentica en la vida real (informativo, sin implementar). */
  authModel: "none" | "oauth2" | "api-key";
  /** Reglas específicas de plataforma habilitadas para este conector. */
  ruleTags: string[];
  capabilities: FieldCapability[];
  /** Devuelve snapshots normalizados. Los conectores sin credenciales
   *  lanzan un error explícito en vez de inventar datos. */
  fetchSnapshots?: (input: {
    rootUrl: string;
    limit: number;
  }) => Promise<{ pages: PageSnapshot[]; sitemapFound: boolean; robotsFound: boolean }>;
}

export function canWrite(connector: PlatformConnector, field: string) {
  return connector.capabilities.some((c) => c.field === field && c.write);
}
