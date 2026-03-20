import type { AuditEvent } from '@imara/core';

export interface EventQuery {
  sessionId?: string;
  serverName?: string;
  toolName?: string;
  policyDecision?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStore {
  append(event: AuditEvent): void;
  query(filter: EventQuery): AuditEvent[];
  getLatestHash(): string | null;
  getEventCount(): number;
  getAllEvents(limit?: number, offset?: number): AuditEvent[];
  getSessionIds(): string[];
  close(): void;
}
