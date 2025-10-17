import json

with open("globe/countries.geojson") as f:
    geojson = json.load(f)

centroids = []

for feature in geojson["features"]:
    geom_type = feature["geometry"]["type"]
    coords = feature["geometry"]["coordinates"]

    all_points = []

    if geom_type == "Polygon":
        for ring in coords:
            all_points.extend(ring)
    elif geom_type == "MultiPolygon":
        for polygon in coords:
            for ring in polygon:
                all_points.extend(ring)

    if not all_points:
        continue

    # Separate lon and lat
    lons, lats = zip(*all_points)

    centroid_lon = sum(lons) / len(lons)
    centroid_lat = sum(lats) / len(lats)

    centroids.append({
        "name": feature["properties"]["name"],
        "lon": centroid_lon,
        "lat": centroid_lat
    })

print(centroids)
# with open("centroids2.json", "w", encoding="utf-8") as f:
#     json.dump(centroids, f, indent=2)

# print(f"Saved {len(centroids)} centroids to centroids2.json")