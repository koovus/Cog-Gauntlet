import { PartDef, PartSlot, EquippedParts } from './types';
import { ENERGY_DRAIN_RATE } from './constants';

function p(
  id: string, name: string, slot: PartSlot,
  maxIntegrity: number, speedBonus: number, energyDrainMod: number,
  damage: number, fireRate: number,
): PartDef {
  return { id, name, slot, integrity: maxIntegrity, maxIntegrity, speedBonus, energyDrainMod, damage, fireRate };
}

export const ALL_PARTS: PartDef[] = [
  p('core_military', 'Military Core', 'core', 120, 0, 1.2, 0, 0),
  p('core_research', 'Research Core', 'core', 80, 1.0, 0.8, 0, 0),
  p('core_tactical', 'Tactical Core', 'core', 100, 0.5, 1.0, 0, 0),
  p('core_salvage', 'Salvage Core', 'core', 65, 0.5, 0.85, 0, 0),

  p('prop_light', 'Light Treads', 'propulsion', 40, 2.0, 0.85, 0, 0),
  p('prop_heavy', 'Heavy Tracks', 'propulsion', 85, -1.0, 1.2, 0, 0),
  p('prop_maglev', 'Mag-Lev Pod', 'propulsion', 28, 3.0, 1.3, 0, 0),
  p('prop_crawler', 'Crawler Legs', 'propulsion', 60, 0.5, 0.9, 0, 0),

  p('weap_plasma', 'Plasma Cannon', 'weapon', 55, 0, 1.1, 28, 1.1),
  p('weap_ion', 'Ion Beam', 'weapon', 40, 0, 1.0, 15, 2.6),
  p('weap_scatter', 'Scatter Shot', 'weapon', 45, 0, 1.0, 12, 2.0),
  p('weap_rail', 'Heavy Rail', 'weapon', 60, 0, 1.3, 45, 0.55),

  p('util_shield', 'Shield Cell', 'utility', 75, 0, 1.1, 0, 0),
  p('util_sensor', 'Sensor Array', 'utility', 30, 0.5, 0.88, 0, 0),
  p('util_repair', 'Repair Module', 'utility', 50, 0, 1.0, 0, 0),
];

export function makeDefaultParts(): { core: PartDef; propulsion: PartDef; weapon: PartDef; utility: null } {
  return {
    core: p('core_basic', 'Basic Core', 'core', 100, 0, 1.0, 0, 0),
    propulsion: p('prop_basic', 'Basic Treads', 'propulsion', 50, 0, 1.0, 0, 0),
    weapon: p('weap_basic', 'Basic Blaster', 'weapon', 50, 0, 1.0, 15, 1.5),
    utility: null,
  };
}

export function getPlayerSpeed(parts: EquippedParts): number {
  return 5 + (parts.propulsion?.speedBonus ?? 0);
}

export function getPlayerDamage(parts: EquippedParts): number {
  return parts.weapon?.damage ?? 15;
}

export function getPlayerFireRate(parts: EquippedParts): number {
  return parts.weapon?.fireRate ?? 1.5;
}

export function getEnergyDrain(parts: EquippedParts): number {
  const base = ENERGY_DRAIN_RATE;
  const cm = parts.core?.energyDrainMod ?? 1;
  const pm = parts.propulsion?.energyDrainMod ?? 1;
  const wm = parts.weapon?.energyDrainMod ?? 1;
  const um = parts.utility?.energyDrainMod ?? 1;
  return base * cm * pm * wm * um;
}

export function shouldAutoEquip(current: PartDef | null, incoming: PartDef): boolean {
  if (!current) return true;
  return incoming.maxIntegrity > current.maxIntegrity;
}
