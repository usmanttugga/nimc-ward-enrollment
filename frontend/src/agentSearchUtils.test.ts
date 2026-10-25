/**
 * Tests for agent search utilities used across all Admin portal tabs.
 *
 * Requirement: admins can search agents by name, email, Device ID and
 * DROID No. on Enrollment Records, Agents, Enrollment Log, Personalization
 * and Account Details.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeQuery,
  matchesQuery,
  agentSearchFields,
  filterAgentsByQuery,
  matchesRecordWithAgents,
  AgentSearchable,
} from './agentSearchUtils';

const agent: AgentSearchable = {
  name: 'John Okafor',
  email: 'john.okafor@example.com',
  deviceId: 'DEV-001',
  deviceDroidNumber: 'DROID-S120-45',
  phone: '08031234567',
};

describe('normalizeQuery', () => {
  it('lowercases and trims', () => {
    expect(normalizeQuery('  John  ')).toBe('john');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeQuery(null)).toBe('');
    expect(normalizeQuery(undefined)).toBe('');
  });
});

describe('matchesQuery', () => {
  it('empty query matches everything', () => {
    expect(matchesQuery('')).toBe(true);
    expect(matchesQuery('   ')).toBe(true);
    expect(matchesQuery(null, 'anything')).toBe(true);
  });

  it('matches any provided value case-insensitively', () => {
    expect(matchesQuery('okafor', 'John Okafor', 'other')).toBe(true);
    expect(matchesQuery('OKAFOR', 'John Okafor')).toBe(true);
    expect(matchesQuery('nomatch', 'John Okafor')).toBe(false);
  });

  it('treats null/undefined values as empty strings without throwing', () => {
    expect(matchesQuery('x', null, undefined)).toBe(false);
    expect(matchesQuery('x', 'text', null)).toBe(true);
  });
});

describe('agentSearchFields', () => {
  it('exposes name, email, deviceId, droid and phone', () => {
    expect(agentSearchFields(agent)).toEqual([
      'John Okafor',
      'john.okafor@example.com',
      'DEV-001',
      'DROID-S120-45',
      '08031234567',
    ]);
  });
});

describe('filterAgentsByQuery', () => {
  const agents: AgentSearchable[] = [
    agent,
    { name: 'Amina Bello', email: 'amina@example.com', deviceId: 'DEV-002', deviceDroidNumber: 'DROID-S120-99' },
    { name: 'Chidi Okonkwo', email: 'chidi@example.com' }, // missing device fields
    { name: null, email: null, deviceId: null, deviceDroidNumber: null, phone: null }, // all null
  ];

  it('returns all agents for an empty query', () => {
    expect(filterAgentsByQuery(agents, '')).toHaveLength(4);
    expect(filterAgentsByQuery(agents, '   ')).toHaveLength(4);
  });

  it('filters by name', () => {
    expect(filterAgentsByQuery(agents, 'amina').map(a => a.name)).toEqual(['Amina Bello']);
  });

  it('filters by email', () => {
    expect(filterAgentsByQuery(agents, 'chidi@').map(a => a.name)).toEqual(['Chidi Okonkwo']);
  });

  it('filters by Device ID', () => {
    expect(filterAgentsByQuery(agents, 'DEV-002').map(a => a.name)).toEqual(['Amina Bello']);
  });

  it('filters by DROID No.', () => {
    expect(filterAgentsByQuery(agents, 'S120-45').map(a => a.name)).toEqual(['John Okafor']);
  });

  it('filters by phone', () => {
    expect(filterAgentsByQuery(agents, '08031234567').map(a => a.name)).toEqual(['John Okafor']);
  });

  it('is case-insensitive', () => {
    expect(filterAgentsByQuery(agents, 'AMINA')).toHaveLength(1);
    expect(filterAgentsByQuery(agents, 'droid-s120-99')).toHaveLength(1);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterAgentsByQuery(agents, 'does-not-exist')).toEqual([]);
  });

  it('never throws on records with null fields', () => {
    expect(() => filterAgentsByQuery(agents, 'x')).not.toThrow();
  });
});

describe('matchesRecordWithAgents', () => {
  const agentsById = new Map<string, AgentSearchable>([['uid-1', agent]]);
  const agentsByEmail = new Map<string, AgentSearchable>([['john.okafor@example.com', agent]]);

  it('empty query matches any record', () => {
    expect(matchesRecordWithAgents('', { agentName: 'X' }, agentsById, agentsByEmail)).toBe(true);
  });

  it('matches the record own fields (agentName)', () => {
    expect(matchesRecordWithAgents('okafor', { agentName: 'John Okafor' }, agentsById, agentsByEmail)).toBe(true);
  });

  it('matches DROID No. resolved via agentId', () => {
    expect(
      matchesRecordWithAgents('S120-45', { agentId: 'uid-1', agentName: 'John Okafor' }, agentsById, agentsByEmail),
    ).toBe(true);
  });

  it('matches email resolved via agentEmail when agentId is absent', () => {
    expect(
      matchesRecordWithAgents('okafor@example', { agentEmail: 'john.okafor@example.com' }, agentsById, agentsByEmail),
    ).toBe(true);
  });

  it('does not match unrelated queries', () => {
    expect(
      matchesRecordWithAgents('zzz', { agentId: 'uid-1', agentName: 'John Okafor' }, agentsById, agentsByEmail),
    ).toBe(false);
  });

  it('does not throw when the agent is unknown or maps are missing', () => {
    expect(matchesRecordWithAgents('x', { agentId: 'missing' }, agentsById)).toBe(false);
    expect(matchesRecordWithAgents('x', {}, agentsById, agentsByEmail)).toBe(false);
    expect(matchesRecordWithAgents('x', {}, new Map())).toBe(false);
  });
});
