import { NextRequest, NextResponse } from "next/server";
import { normalizeBbox, queryOverpassApi } from "@/lib/osm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const w = Number(searchParams.get("w"));
  const s = Number(searchParams.get("s"));
  const e = Number(searchParams.get("e"));
  const n = Number(searchParams.get("n"));

  if ([w, s, e, n].some((v) => Number.isNaN(v))) {
    return NextResponse.json({ error: "Invalid bbox parameters" }, { status: 400 });
  }

  // Cap bbox size to 2x2 km (4 km²) to prevent Overpass API abuse
  const latDiff = Math.abs(n - s);
  const lonDiff = Math.abs(e - w);
  const avgLatRad = ((n + s) / 2) * (Math.PI / 180);
  const heightKm = latDiff * 111;
  const widthKm = lonDiff * 111 * Math.cos(avgLatRad);
  const areaKm2 = heightKm * widthKm;

  if (areaKm2 > 4.5) {
    return NextResponse.json({ error: "Bounding box area exceeds the 2x2 km (4 km²) limit" }, { status: 400 });
  }

  const bbox = normalizeBbox([w, s, e, n]);

  try {
    const data = await queryOverpassApi(bbox);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch OSM data";
    console.error("OSM API route error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
