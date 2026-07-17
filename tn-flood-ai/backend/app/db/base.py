# Import all the models, so that Base has them before being imported by Alembic
from app.db.base_class import Base
from app.models.user import User
from app.models.district import District
from app.models.weather import Weather, Rainfall
from app.models.river import RiverLevel
from app.models.prediction import DistrictPrediction
from app.models.alert import Alert
from app.models.facility import Shelter, Hospital
from app.models.report import Report
from app.models.infrastructure import Road, Building
from app.models.terrain import DemTile, Landcover
from app.models.logs import EtlLog, SchedulerLog, ApiLog
