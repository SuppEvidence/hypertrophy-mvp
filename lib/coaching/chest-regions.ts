/** Classification defaults for chest movements; individual exercise choices override them. */
export const chestRegionForMovement: Record<string, "Upper chest" | "Mid chest" | "Lower chest"> = {
  "Incline press": "Upper chest",
  "Low-to-high chest fly/press": "Upper chest",
  "Flat press": "Mid chest",
  "Decline/dip press": "Lower chest",
};

export function classifyChestPrimary(args: {
  movementName: string;
  primaryIds: string[];
  chestId?: string;
  regionId?: string;
  chestRegionIds?: string[];
}) {
  if (!args.regionId || !chestRegionForMovement[args.movementName]) return args.primaryIds;
  if (args.primaryIds.some((id) => args.chestRegionIds?.includes(id))) {
    return args.primaryIds.filter((id) => id !== args.chestId);
  }
  if (args.chestId && args.primaryIds.includes(args.chestId)) {
    return [...args.primaryIds.filter((id) => id !== args.chestId), args.regionId];
  }
  return [...args.primaryIds, args.regionId];
}
