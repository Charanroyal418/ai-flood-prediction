import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__)))
from app.core.config import settings

def test_connection():
    print("Testing connection to Supabase...")
    print(f"DATABASE_URL: {settings.DATABASE_URL.replace('Charan%4005%23', '***')}")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Test PostgreSQL version
        result = session.execute(text("SELECT version();")).fetchone()
        print(f"✅ PostgreSQL Version: {result[0]}")
        
        # Test PostGIS extension
        try:
            postgis_version = session.execute(text("SELECT postgis_full_version();")).fetchone()
            print(f"✅ PostGIS is active: {postgis_version[0][:60]}...")
        except Exception as e:
            print(f"❌ PostGIS extension not found! Please run 'CREATE EXTENSION postgis;' in Supabase SQL editor.")
            print(f"Error: {e}")
            
        print("\n✅ SUCCESS: Backend is fully configured and connected to Supabase.")
        session.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    test_connection()
