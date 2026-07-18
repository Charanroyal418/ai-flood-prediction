import psycopg2
import os

DATABASE_URL = "postgresql://postgres.eohziaiwuuyxxpkhdhoz:XG3zg%2F5*n58Um%2C5@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

# Unquote the password for psycopg2 directly
import urllib.parse
parsed = urllib.parse.urlparse(DATABASE_URL)
password = urllib.parse.unquote(parsed.password)
conn = psycopg2.connect(
    dbname=parsed.path[1:],
    user=parsed.username,
    password=password,
    host=parsed.hostname,
    port=parsed.port
)
conn.autocommit = True

with conn.cursor() as cur:
    print("Checking if realtime publication exists...")
    cur.execute("SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime';")
    if not cur.fetchone():
        cur.execute("CREATE PUBLICATION supabase_realtime;")
        print("Created publication supabase_realtime.")
    
    print("Adding tables to realtime publication...")
    # Add tables. We use IF NOT EXISTS logic via try/except or just run it and catch error
    for table in ["district_predictions", "alerts"]:
        try:
            cur.execute(f"ALTER PUBLICATION supabase_realtime ADD TABLE {table};")
            print(f"Added {table} to realtime.")
        except psycopg2.errors.DuplicateObject:
            print(f"{table} is already in realtime publication.")
            conn.rollback()
        except Exception as e:
            print(f"Error adding {table}: {e}")
            conn.rollback()

print("Done.")
conn.close()
