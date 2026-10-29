-- Set every station's current hourly rate to the new uniform PC rate.
update public.stations
set hourly_rate = 100;
