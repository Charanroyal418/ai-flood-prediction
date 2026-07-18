import app.db.base
from sqlalchemy.orm import configure_mappers
try:
    configure_mappers()
    print("Mappers configured successfully!")
except Exception as e:
    import traceback
    traceback.print_exc()
