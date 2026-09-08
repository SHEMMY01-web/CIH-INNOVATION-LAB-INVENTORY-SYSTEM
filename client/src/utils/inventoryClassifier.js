/**
 * CIH Innovation Lab Inventory Classification & Domain Utilities
 * High-precision domain categorizer tailored for maker equipment, Arduino kits,
 * sensors, robotics, 3D printing, electronics prototyping, and lab tools.
 */

export const HARDWARE_CATEGORIES = [
  'Microcontrollers & Boards',
  'Sensors & Modules',
  'Motors & Actuators',
  'Robotics & STEM Kits',
  '3D Printing & Fabrication',
  'Lab Tools & Equipment',
  'Components & Wiring',
  'VR & Multimedia'
];

export const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'packs', label: 'Packs (packs)' },
  { value: 'boxes', label: 'Boxes (boxes)' },
  { value: 'meters', label: 'Meters (m)' }
];

/**
 * Classifies an inventory item into an authentic Innovation Lab hardware domain
 * @param {Object} item
 * @returns {string} Category name
 */
export function classifyItem(item) {
  if (!item) return 'Components & Wiring';
  const rawType = (item.type || '').toLowerCase().trim();
  const name = (item.item_name || item.name || '').toLowerCase().trim();

  // Explicit type overrides if structured type is defined
  if (rawType.startsWith('asset:')) {
    const sub = rawType.split(':')[1]?.trim();
    if (sub && sub !== '-' && sub !== 'general') {
      if (sub === 'lap' || sub === 'laptop') return 'VR & Multimedia'; // or workstations
      return `Asset • ${sub.toUpperCase()}`;
    }
    // Check name if type is generic asset
    if (!name.includes('rtyui')) {
      // continue to name-based classification
    } else {
      return 'VR & Multimedia';
    }
  }
  
  if (rawType.startsWith('tool:')) {
    return 'Lab Tools & Equipment';
  }

  // 1. VR, Multimedia & Audio
  if (
    name.includes('vr') ||
    name.includes('oculus') ||
    name.includes('cardboard') ||
    name.includes('camera') ||
    name.includes('headphone') ||
    name.includes('ear-piece') ||
    name.includes('mp3')
  ) {
    return 'VR & Multimedia';
  }

  // 2. 3D Printing & Additive Fabrication
  if (
    name.includes('3d') ||
    name.includes('printer') ||
    name.includes('printing') ||
    name.includes('filament') ||
    name.includes('bambu') ||
    name.includes('ender')
  ) {
    return '3D Printing & Fabrication';
  }

  // 3. Robotics & STEM Kits
  if (
    name.includes('drone') ||
    name.includes('tello') ||
    name.includes('we-do') ||
    name.includes('wedo') ||
    name.includes('mbot') ||
    name.includes('robot') ||
    name.includes('madeblock') ||
    name.includes('science set') ||
    (name.includes('kit') && !name.includes('sensor kit'))
  ) {
    return 'Robotics & STEM Kits';
  }

  // 4. Sensors, Displays & Input Modules
  if (
    name.includes('sensor') ||
    name.includes('dht') ||
    name.includes('ultrasonic') ||
    name.includes('pir') ||
    name.includes('matrix') ||
    name.includes('display') ||
    name.includes('lcd') ||
    name.includes('keypad') ||
    name.includes('7 segment') ||
    name.includes('infra-red') ||
    name.includes('rfid') ||
    name.includes('light dependent')
  ) {
    return 'Sensors & Modules';
  }

  // 5. Motors, Servos & Actuators
  if (
    name.includes('motor') ||
    name.includes('servo') ||
    name.includes('stepper') ||
    name.includes('pump') ||
    name.includes('buzzer') ||
    name.includes('actuator')
  ) {
    return 'Motors & Actuators';
  }

  // 6. Lab Hand Tools & Assembly Equipment
  if (
    name.includes('sodering') ||
    name.includes('soldering') ||
    name.includes('glue gun') ||
    name.includes('screw') ||
    name.includes('scissors') ||
    name.includes('peltier') ||
    name.includes('charger')
  ) {
    return 'Lab Tools & Equipment';
  }

  // 7. Microcontrollers & Development Boards
  if (
    name.includes('arduino') ||
    name.includes('esps') ||
    name.includes('esp32') ||
    name.includes('shield') ||
    name.includes('relay')
  ) {
    return 'Microcontrollers & Boards';
  }

  // 8. Electronic Components, Wiring & Hardware
  return 'Components & Wiring';
}

/**
 * Determines whether an item qualifies as a Lab Tool
 */
export function isLabTool(item) {
  if (!item) return false;
  const t = (item.type || '').toLowerCase();
  if (t.startsWith('tool:')) return true;
  return classifyItem(item) === 'Lab Tools & Equipment';
}

/**
 * Determines whether an item qualifies as a Heavy/Lab Asset
 */
export function isLabAsset(item) {
  if (!item) return false;
  const t = (item.type || '').toLowerCase();
  if (t.startsWith('asset:')) return true;
  const name = (item.item_name || item.name || '').toLowerCase();
  if (
    name.includes('bambu') ||
    name.includes('ender') ||
    name.includes('printing machine') ||
    name.includes('oculus') ||
    name.includes('camera') ||
    name.includes('laptop') ||
    name.includes('rtyui')
  ) {
    return true;
  }
  return false;
}

/**
 * Extracts unique packaging units from item list
 */
export function getAvailableUnits(items = []) {
  const unitsMap = new Map();
  UNIT_OPTIONS.forEach(u => unitsMap.set(u.value, u.label));

  items.forEach(i => {
    if (i.store && i.store.trim()) {
      const val = i.store.trim().toLowerCase();
      if (!unitsMap.has(val)) {
        unitsMap.set(val, val.charAt(0).toUpperCase() + val.slice(1));
      }
    }
  });

  return Array.from(unitsMap.entries()).map(([value, label]) => ({ value, label }));
}

/**
 * Resolves the full structured type (e.g. 'asset:3D Printing & Fabrication', 'tool:Lab Tools & Equipment', 'item:Sensors & Modules')
 * based on the authentic domain filter classification.
 */
export function getStructuredItemType(item) {
  if (!item) return 'item:Components & Wiring';
  const existingType = (item.type || '').trim();
  // If item already has a meaningful non-placeholder type:
  if (existingType && existingType !== 'item:-' && existingType !== 'item:general' && existingType !== '-') {
    return existingType;
  }
  const category = classifyItem(item);
  let prefix = 'item';
  if (isLabAsset(item)) {
    prefix = 'asset';
  } else if (isLabTool(item)) {
    prefix = 'tool';
  }
  return `${prefix}:${category}`;
}

/**
 * Returns a clean, human-friendly display label for an item's type
 * e.g. "Sensors & Modules", "Lab Tools & Equipment", "3D Printing & Fabrication"
 */
export function getItemTypeLabel(item) {
  if (!item) return 'Components & Wiring';
  const structured = getStructuredItemType(item);
  if (structured.includes(':')) {
    const parts = structured.split(':');
    const prefix = parts[0];
    const category = parts.slice(1).join(':').trim();
    if (prefix === 'asset') return `Asset • ${category}`;
    if (prefix === 'tool') return `Tool • ${category}`;
    return category || 'General';
  }
  return structured;
}

/**
 * Normalizes an item so that item.type is always populated
 * with its authentic hardware classification
 */
export function enrichItemWithType(item) {
  if (!item) return item;
  return {
    ...item,
    type: getStructuredItemType(item)
  };
}

/**
 * Normalizes an array of items so that all items have authentic domain types
 */
export function enrichItemsWithType(items) {
  if (!Array.isArray(items)) return [];
  return items.map(enrichItemWithType);
}
