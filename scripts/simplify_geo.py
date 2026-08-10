import os
import geopandas as gpd

def simplify_shapefile():
    # Paths relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Path to the large shapefile
    shp_path = os.path.join(project_root, "raw", "File_584333_0767fb99b02d4e08846da7e9ad44eeaf", "91", "DISTRICT_BOUNDARY.shp")
    
    # Target path for the GeoJSON
    out_dir = os.path.join(project_root, "backend", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "districts.geojson")

    print(f"Loading shapefile from: {shp_path}")
    if not os.path.exists(shp_path):
        print(f"Error: Shapefile not found at {shp_path}")
        return

    # Load shapefile
    gdf = gpd.read_file(shp_path)
    print(f"Original size: {len(gdf)} records, CRS: {gdf.crs}")

    # Simplify geometry (0.01 degrees is roughly 1km, preserves enough shape for district visualization)
    print("Simplifying geometries...")
    # simplify with a tolerance of 0.01 degrees. Use a smaller number if it looks too blocky
    gdf['geometry'] = gdf['geometry'].simplify(tolerance=0.01, preserve_topology=True)
    
    # Keep only the essential columns (e.g., district name) to reduce file size further
    col_name = None
    for col in ['dtname', 'DISTRICT', 'NAME', 'name', 'District']:
        if col in gdf.columns:
            col_name = col
            break
            
    if col_name:
        print(f"Preserving column: {col_name} as 'name'")
        gdf = gdf[[col_name, 'geometry']]
        gdf = gdf.rename(columns={col_name: 'name'})
    else:
        print("Warning: District name column not found, keeping all columns.")

    # Save to GeoJSON
    print(f"Saving simplified GeoJSON to: {out_path}")
    gdf.to_file(out_path, driver="GeoJSON")
    
    # Print file size
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Done! Simplified GeoJSON size: {size_mb:.2f} MB")
    print("You can now safely run the git filter-repo command to delete the old shapefile.")

if __name__ == "__main__":
    simplify_shapefile()
