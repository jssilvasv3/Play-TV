CREATE TABLE IF NOT EXISTS analytics_hours (
  hour_start INTEGER PRIMARY KEY,
  peak_devices INTEGER NOT NULL DEFAULT 0,
  peak_tv INTEGER NOT NULL DEFAULT 0,
  peak_mobile INTEGER NOT NULL DEFAULT 0,
  peak_desktop INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_channels (
  hour_start INTEGER NOT NULL,
  channel TEXT NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  watch_seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour_start, channel)
);

CREATE INDEX IF NOT EXISTS analytics_channels_hour_idx
  ON analytics_channels (hour_start);
