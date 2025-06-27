// File: app/api/read/route.ts
// ================================
import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { queryPineconeVectorStoreAndQueryLLM } from "@/utils";
import { indexName } from "@/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "`prompt` is required" }, { status: 400 });
  }
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  try {
    const answer = await queryPineconeVectorStoreAndQueryLLM(pc, prompt.trim());
    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error(err);
    if (err.name === "PineconeNotFoundError") {
      return NextResponse.json(
        { error: `Index \"${indexName}\" not found — run /api/setup first.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
