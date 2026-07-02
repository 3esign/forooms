"use client";

import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { normalizeBbox } from "@/lib/osm";

interface MapProps {
  onBoundingBoxSelect: (bbox: [number, number, number, number] | null) => void;
  center?: [number, number] | null;
  zoom?: number;
}

export default function Map({ onBoundingBoxSelect, center, zoom: propsZoom }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [lng] = useState(-73.9855); // Manhattan, NYC
  const [lat] = useState(40.7580);
  const [zoom] = useState(14);

  // Pan to center if changed externally
  useEffect(() => {
    if (map.current && center) {
      map.current.flyTo({
        center: center,
        zoom: propsZoom || 14,
        essential: true
      });
    }
  }, [center, propsZoom]);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [lng, lat],
      zoom: zoom,
      boxZoom: false, // Prevents default map zooming on shift+drag
      doubleClickZoom: false,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    let isDrawing = false;
    let startPoint: maplibregl.LngLat | null = null;
    let currentBox: maplibregl.LngLatBounds | null = null;

    map.current.on('load', () => {
      // Create GeoJSON source for the bounding box
      map.current!.addSource('selection-box', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Translucent fill
      map.current!.addLayer({
        id: 'selection-box-fill',
        type: 'fill',
        source: 'selection-box',
        paint: {
          'fill-color': '#2f81f7',
          'fill-opacity': 0.2
        }
      });

      // Solid outline
      map.current!.addLayer({
        id: 'selection-box-line',
        type: 'line',
        source: 'selection-box',
        paint: {
          'line-color': '#2f81f7',
          'line-width': 2
        }
      });
    });

    const updateBox = (bounds: maplibregl.LngLatBounds | null) => {
      const source = map.current?.getSource('selection-box') as maplibregl.GeoJSONSource;
      if (!source) return;

      if (!bounds) {
         source.setData({ type: 'FeatureCollection', features: [] });
         return;
      }

      const polygon = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [bounds.getWest(), bounds.getNorth()],
            [bounds.getEast(), bounds.getNorth()],
            [bounds.getEast(), bounds.getSouth()],
            [bounds.getWest(), bounds.getSouth()],
            [bounds.getWest(), bounds.getNorth()] // close polygon
          ]]
        }
      };

      source.setData({
        type: 'FeatureCollection',
        features: [polygon as any]
      });
    };

    map.current.on("mousedown", (e) => {
      if (!e.originalEvent.shiftKey) return;
      
      // Start drawing a new box
      map.current!.dragPan.disable();
      isDrawing = true;
      startPoint = e.lngLat;
      currentBox = null;
      updateBox(null);
      onBoundingBoxSelect(null);
    });

    map.current.on("mousemove", (e) => {
      if (!isDrawing || !startPoint) return;

      const currentPoint = e.lngLat;
      currentBox = new maplibregl.LngLatBounds(startPoint, currentPoint);
      updateBox(currentBox);
    });

    map.current.on("mouseup", () => {
      if (!isDrawing) return;
      isDrawing = false;
      map.current!.dragPan.enable();

      if (currentBox) {
        const dLng = Math.abs(currentBox.getEast() - currentBox.getWest());
        const dLat = Math.abs(currentBox.getNorth() - currentBox.getSouth());
        
        // Approx 2x2km max limit check
        if (dLng > 0.03 || dLat > 0.02) {
          alert("Selection too large! Please hold Shift and drag a smaller area (max 2x2 km).");
          updateBox(null);
          currentBox = null;
          onBoundingBoxSelect(null);
          return;
        }

        onBoundingBoxSelect(
          normalizeBbox([
            currentBox.getWest(),
            currentBox.getSouth(),
            currentBox.getEast(),
            currentBox.getNorth(),
          ])
        );
      }
    });

  }, [lng, lat, zoom, onBoundingBoxSelect]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
