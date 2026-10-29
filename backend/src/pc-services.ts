// Public PC offering. Keep this module free of server dependencies and secrets:
// both session billing and the homepage consume this configuration.
export const STATION_HOURLY_RATE = 100;
export const VIP_STATION_HOURLY_RATE = 150;

export const stationHourlyRate = (type: string | null | undefined) =>
  type?.toLowerCase() === "vip" ? VIP_STATION_HOURLY_RATE : STATION_HOURLY_RATE;

export const PC_SERVICE = {
  name: "PC Stations",
  description: "Use a PC with time-based session billing.",
  hourlyRate: STATION_HOURLY_RATE,
} as const;
