// ================================
// File: utils/pinecone.ts  (final fixed version)
// ================================
import { Pinecone } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings, OpenAI } from "@langchain/openai";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "@langchain/core/documents";
import { indexName, VECTOR_DIM } from "@/config";

import crypto from "node:crypto";
import path   from "node:path";

/* ────────────────────────────────
   Utility: generate a Pinecone‑safe vector ID
   ──────────────────────────────── */
const safeId = (filePath: string, chunk: number): string => {
  const base  = path.basename(filePath, path.extname(filePath));           // original name
  const ascii = base
    .normalize("NFKD")                      // canonical form
    .replace(/[^\x00-\x7F]/g, "")        // drop non‑ASCII
    .replace(/[^A-Za-z0-9_-]/g, "_");      // replace spaces & symbols
  // Node crypto supports sha1/sha256/md5—not crc32. Use sha1 and keep 8 chars.
  const tag   = crypto.createHash("sha1").update(base).digest("hex").slice(0, 8);
  return `${ascii || "doc"}_${tag}_${chunk}`; // e.g. "doc_5a1f9c8e_0"
};

/* ────────────────────────────────
   Index creation helper
   ──────────────────────────────── */
const WAIT = 4_000;
export const createPineconeIndex = async (pc: Pinecone) => {
  const { indexes } = await pc.listIndexes();
  if (indexes.some((i) => i.name === indexName)) return;

  await pc.createIndex({
    name: indexName,
    dimension: VECTOR_DIM,
    metric: "cosine",
    spec: { serverless: { cloud: "aws", region: "us-east-1" } },
  });
  while (true) {
    const { status } = await pc.describeIndex(indexName);
    if (status?.state === "Ready") break;
    await new Promise((r) => setTimeout(r, WAIT));
  }
};

/* ────────────────────────────────
   Convert docs → vectors → upsert
   ──────────────────────────────── */
export const updatePinecone = async (
  pc: Pinecone,
  docs: Array<{ pageContent: string; metadata: any }>
) => {
  if (!docs.length) return; // nothing to do
  const index    = pc.index(indexName);
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1_000 });
  const embedder = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY! });

  for (const doc of docs) {
    const chunks     = await splitter.createDocuments([doc.pageContent]);
    const embeddings = await embedder.embedDocuments(
      chunks.map((c) => c.pageContent.replace(/\n/g, " "))
    );
    const vectors = chunks.map((chunk, i) => ({
      id: safeId(doc.metadata.source, i),
      values: embeddings[i],
      metadata: { pageContent: chunk.pageContent },
    }));
    for (let i = 0; i < vectors.length; i += 100)
      await index.upsert(vectors.slice(i, i + 100));
  }
};

/* ────────────────────────────────
   RAG‑style query helper
   ──────────────────────────────── */
export const queryPineconeVectorStoreAndQueryLLM = async (
  pc: Pinecone,
  question: string
) => {
  const index    = pc.index(indexName);
  const embedder = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY! });
  const vector   = await embedder.embedQuery(question);
  const { matches = [] } = await index.query({
    vector, topK: 10, includeMetadata: true,
  });
  if (!matches.length) return "No relevant documents found.";

  const llm   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const chain = loadQAStuffChain(llm);
  const corpus = matches.map((m) => (m.metadata?.pageContent as string) ?? "").join(" ");
  const result = await chain._call({
    input_documents: [new Document({ pageContent: corpus })],
    question,
  });
  return result.text;
};

// ================================
// END utils/pinecone.ts
// ================================
