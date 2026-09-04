import sqlite3
import json

conn = sqlite3.connect('floodsense.db')
c = conn.cursor()

# Get all tables
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in c.fetchall()]
print("Tables:", tables)

# Count river_levels records
c.execute('SELECT COUNT(*) FROM river_levels')
total = c.fetchone()[0]
print('Total river_levels records:', total)

# Get distinct station_names with their river_names
c.execute('SELECT DISTINCT river_name, station_name FROM river_levels ORDER BY river_name, station_name')
rows = c.fetchall()
print(f'\nDistinct (river_name, station_name) pairs: {len(rows)}')
for row in rows:
    print(f'  River: {row[0]!r:40s} | Station: {row[1]!r}')

# Check if district table exists and has data
c.execute('SELECT COUNT(*) FROM districts')
print(f'\nDistricts count: {c.fetchone()[0]}')

# Get latest records per station
c.execute('''
    SELECT rl.river_name, rl.station_name, rl.current_level, rl.danger_level, rl.recorded_at, d.name as district_name
    FROM river_levels rl
    JOIN (
        SELECT station_name, MAX(recorded_at) as max_date
        FROM river_levels
        GROUP BY station_name
    ) latest ON rl.station_name = latest.station_name AND rl.recorded_at = latest.max_date
    LEFT JOIN districts d ON rl.district_id = d.id
    ORDER BY rl.river_name, rl.station_name
''')
latest = c.fetchall()
print(f'\nLatest records per station: {len(latest)}')
for row in latest:
    print(f'  {row[0]!r:30s} | {row[1]!r:40s} | current={row[2]} | danger={row[3]} | district={row[5]}')

conn.close()
