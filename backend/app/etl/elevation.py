import requests
import logging

logger = logging.getLogger(__name__)

def get_elevation(lat: float, lon: float) -> float:
    """
    Fetch elevation for a given coordinate pair from Open-Meteo Elevation API (Copernicus DEM).
    """
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if "elevation" in data and len(data["elevation"]) > 0:
            return float(data["elevation"][0])
    except Exception as e:
        logger.error(f"Failed to fetch elevation from Open-Meteo: {e}")
    # Fallback default
    return 15.0

def get_elevations_bulk(coords: list[tuple[float, float]]) -> list[float]:
    """
    Fetch elevations in bulk for a list of coordinates.
    coords: list of (latitude, longitude) tuples
    """
    if not coords:
        return []
    
    lats = [str(lat) for lat, _ in coords]
    lons = [str(lon) for _, lon in coords]
    lat_str = ",".join(lats)
    lon_str = ",".join(lons)
    
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat_str}&longitude={lon_str}"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        if "elevation" in data:
            return [float(val) for val in data["elevation"]]
    except Exception as e:
        logger.error(f"Failed to fetch bulk elevations: {e}")
        
    return [15.0] * len(coords)
