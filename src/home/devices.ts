// Device catalog: the single source of truth for what exists in the home,
// which actions each kind of device accepts, and how risky each action is.
// The prompt, the validator and the executor are all generated from this file.

export type Risk = 'safe' | 'notable' | 'sensitive';

export type DeviceKind =
  | 'light'
  | 'blinds'
  | 'tv'
  | 'speaker'
  | 'vacuum'
  | 'thermostat'
  | 'lock'
  | 'garage'
  | 'alarm'
  | 'camera';

export type ParamName =
  | 'on'
  | 'brightness'
  | 'color'
  | 'position'
  | 'volume'
  | 'input'
  | 'playlist'
  | 'target'
  | 'mode';

export interface ActionSpec {
  params: ParamName[];
  required?: ParamName[];
  risk: Risk;
  describe: string;
}

export interface DeviceInfo {
  id: string;
  kind: DeviceKind;
  room: string;
  label: string;
}

export const DEVICES: DeviceInfo[] = [
  { id: 'living.ceiling', kind: 'light', room: 'Living room', label: 'Ceiling pendant' },
  { id: 'living.lamp', kind: 'light', room: 'Living room', label: 'Floor lamp' },
  { id: 'living.strip', kind: 'light', room: 'Living room', label: 'LED strip behind TV' },
  { id: 'living.blinds', kind: 'blinds', room: 'Living room', label: 'Window blinds' },
  { id: 'living.tv', kind: 'tv', room: 'Living room', label: 'TV' },
  { id: 'living.speaker', kind: 'speaker', room: 'Living room', label: 'Speaker' },
  { id: 'living.vacuum', kind: 'vacuum', room: 'Living room', label: 'Robot vacuum' },
  { id: 'home.thermostat', kind: 'thermostat', room: 'Whole home', label: 'Thermostat' },
  { id: 'entry.frontdoor', kind: 'lock', room: 'Living room', label: 'Front door lock' },
  { id: 'garage.door', kind: 'garage', room: 'Garage', label: 'Garage door' },
  { id: 'home.alarm', kind: 'alarm', room: 'Whole home', label: 'Security alarm' },
  { id: 'home.cameras', kind: 'camera', room: 'Whole home', label: 'Security cameras' },
];

export const DEVICE_BY_ID: Record<string, DeviceInfo> = Object.fromEntries(
  DEVICES.map((d) => [d.id, d]),
);

export const ACTIONS: Record<DeviceKind, Record<string, ActionSpec>> = {
  light: {
    set: { params: ['on', 'brightness', 'color'], risk: 'safe', describe: 'turn on/off, brightness 0-100, color (hex or name)' },
  },
  blinds: {
    set: { params: ['position'], required: ['position'], risk: 'safe', describe: 'position = percent open, 0 closed to 100 open' },
  },
  tv: {
    set: { params: ['on', 'input', 'volume'], risk: 'safe', describe: 'on/off, input (movies|news|sports|gaming|music), volume 0-100' },
  },
  speaker: {
    set: { params: ['on', 'playlist', 'volume'], risk: 'safe', describe: 'on/off, playlist name, volume 0-100' },
  },
  vacuum: {
    start: { params: [], risk: 'notable', describe: 'start cleaning (runs 30 min then docks)' },
    dock: { params: [], risk: 'safe', describe: 'return to dock' },
  },
  thermostat: {
    set: { params: ['target', 'mode'], risk: 'notable', describe: 'target 60-85 F, mode (heat|cool|auto|eco|off)' },
  },
  lock: {
    lock: { params: [], risk: 'safe', describe: 'lock the door' },
    unlock: { params: [], risk: 'sensitive', describe: 'unlock the door (auto-relocks after 15 min)' },
  },
  garage: {
    close: { params: [], risk: 'safe', describe: 'close the garage door' },
    open: { params: [], risk: 'sensitive', describe: 'open the garage door' },
  },
  alarm: {
    arm: { params: ['mode'], required: ['mode'], risk: 'safe', describe: 'arm, mode (home|away)' },
    disarm: { params: [], risk: 'sensitive', describe: 'disarm the alarm' },
  },
  camera: {
    on: { params: [], risk: 'safe', describe: 'turn cameras on' },
    off: { params: [], risk: 'sensitive', describe: 'turn cameras off' },
  },
};

export const TV_INPUTS = ['movies', 'news', 'sports', 'gaming', 'music'] as const;
export const THERMOSTAT_MODES = ['heat', 'cool', 'auto', 'eco', 'off'] as const;
export const ALARM_MODES = ['home', 'away'] as const;

export const NAMED_COLORS: Record<string, string> = {
  warm: '#ffb46b',
  'warm white': '#ffc98a',
  white: '#fff4e5',
  'cool white': '#dfeaff',
  cool: '#cfe3ff',
  amber: '#ffa23a',
  orange: '#ff8a3d',
  red: '#ff4d4d',
  pink: '#ff7ad9',
  purple: '#a46bff',
  blue: '#4d8dff',
  teal: '#2fd6c4',
  cyan: '#4de4ff',
  green: '#59e07a',
  yellow: '#ffe15a',
};

/** Numeric ranges enforced by the validator (values outside are clamped). */
export const RANGES: Partial<Record<ParamName, [number, number]>> = {
  brightness: [0, 100],
  position: [0, 100],
  volume: [0, 100],
  target: [60, 85],
};

export const MAX_STEPS = 16;
