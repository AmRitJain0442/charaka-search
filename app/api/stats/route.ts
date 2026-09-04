import { NextResponse } from "next/server";
import { corpusStats } from "@/lib/search";

export function GET() {
  return NextResponse.json(corpusStats());
}
