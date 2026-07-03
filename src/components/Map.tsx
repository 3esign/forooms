"use client";

import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { normalizeBbox } from "@/lib/osm";
import { ActiveForoom } from "../../party/auth";

interface MapProps {
  onBoundingBoxSelect: (bbox: [number, number, number, number] | null) => void;
  forooms: ActiveForoom[];
  allowDrawing: boolean;
  center?: [number, number] | null;
  zoom?: number;
}

export default function Map({ onBoundingBoxSelect, forooms, allowDrawing, center, zoom: propsZoom }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [lng] = useState(20.5122); // Novi Pazar
  const [lat] = useState(43.1367);
  const [zoom] = useState(14);

  // Use refs to prevent stale closure issues inside Maplibre event listeners
  const allowDrawingRef = useRef(allowDrawing);
  const onBoundingBoxSelectRef = useRef(onBoundingBoxSelect);

  // Keep refs in sync with props
  useEffect(() => {
    allowDrawingRef.current = allowDrawing;
  }, [allowDrawing]);

  useEffect(() => {
    onBoundingBoxSelectRef.current = onBoundingBoxSelect;
  }, [onBoundingBoxSelect]);

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

  // Update existing forooms layer whenever the list changes
  useEffect(() => {
    if (!map.current) return;
    const updateForoomsLayer = () => {
      const source = map.current?.getSource("existing-forooms") as maplibregl.GeoJSONSource;
      if (!source) return;

      const features = forooms.map((foroom) => {
        const [w, s, e, n] = foroom.bbox;
        return {
          type: "Feature",
          properties: {
            id: foroom.id,
            name: foroom.name,
            creatorEmail: foroom.creatorEmail,
            bbox: foroom.bbox
          },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [w, n],
              [e, n],
              [e, s],
              [w, s],
              [w, n]
            ]]
          }
        };
      });

      source.setData({
        type: "FeatureCollection",
        features: features as any
      });
    };

    if (map.current.isStyleLoaded()) {
      updateForoomsLayer();
    } else {
      map.current.on("load", updateForoomsLayer);
    }
  }, [forooms]);

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

    map.current.on('load', () => {
      // Create GeoJSON source for active/registered forooms
      map.current!.addSource("existing-forooms", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });

      // Translucent green fill for created forums
      map.current!.addLayer({
        id: "existing-forooms-fill",
        type: "fill",
        source: "existing-forooms",
        paint: {
          "fill-color": "#10b981", // Emerald green
          "fill-opacity": 0.3
        }
      });

      // Green outline
      map.current!.addLayer({
        id: "existing-forooms-outline",
        type: "line",
        source: "existing-forooms",
        paint: {
          "line-color": "#10b981",
          "line-width": 3
        }
      });

      // Selection box
      map.current!.addSource('selection-box', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.current!.addLayer({
        id: 'selection-box-fill',
        type: 'fill',
        source: 'selection-box',
        paint: {
          'fill-color': '#2f81f7',
          'fill-opacity': 0.2
        }
      });

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

    // Handle clicking on existing forums to select them
    map.current.on("click", "existing-forooms-fill", (e) => {
      const feature = e.features?.[0];
      if (feature && feature.properties) {
        try {
          const bbox = JSON.parse(feature.properties.bbox) as [number, number, number, number];
          onBoundingBoxSelectRef.current(bbox);
        } catch (err) {
          console.error("Failed to parse bbox", err);
        }
      }
    });

    // Change cursor on hover over existing forooms
    map.current.on("mouseenter", "existing-forooms-fill", () => {
      if (map.current) map.current.getCanvas().style.cursor = "pointer";
    });
    map.current.on("mouseleave", "existing-forooms-fill", () => {
      if (map.current) map.current.getCanvas().style.cursor = "";
    });

    map.current.on("mousedown", (e) => {
      if (!allowDrawingRef.current) return; // Disallow guests/unauthorized users
      if (!e.originalEvent.shiftKey) return;
      
      // Start drawing a new box
      map.current!.dragPan.disable();
      isDrawing = true;
      startPoint = e.lngLat;
      currentBox = null;
      updateBox(null);
      onBoundingBoxSelectRef.current(null);
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
          onBoundingBoxSelectRef.current(null);
          return;
        }

        onBoundingBoxSelectRef.current(
          normalizeBbox([
            currentBox.getWest(),
            currentBox.getSouth(),
            currentBox.getEast(),
            currentBox.getNorth(),
          ])
        );
      }
    });

  }, [lng, lat, zoom]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
