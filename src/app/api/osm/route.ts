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
