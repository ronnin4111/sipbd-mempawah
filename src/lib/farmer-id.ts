/**
 * Generate a deterministic farmerId from farmer identity fields.
 * Same farmer (same name, group, kecamatan, desa) = same farmerId.
 * This enables deduplication across years without schema changes.
 */
export function generateFarmerId(data: {
  farmerName: string;
  groupName: string;
  kecamatan: string;
  desa: string;
}): string {
  const parts = [
    data.kecamatan.trim().toLowerCase(),
    data.desa.trim().toLowerCase(),
    data.farmerName.trim().toLowerCase(),
    data.groupName.trim().toLowerCase(),
  ];
  
  // Simple hash function (djb2) for compact ID
  const raw = parts.join('|');
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to positive hex string, prefix with "F" for readability
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `F${hex}`;
}
