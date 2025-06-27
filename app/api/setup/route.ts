import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { createPineconeIndex, updatePinecone } from "@/utils";
import { indexName } from "@/config";
import path from "node:path";
import { DirectoryLoader }  from "langchain/document_loaders/fs/directory";
import { TextLoader }       from "langchain/document_loaders/fs/text";
import { PDFLoader }        from "@langchain/community/document_loaders/fs/pdf";



export const runtime = "nodejs";

export async function POST() {
 const docsDir = path.join(process.cwd(), "documents");      // project-root/documents
const loader  = new DirectoryLoader(
  docsDir,
  {
    ".txt": (p) => new TextLoader(p),
    ".md" : (p) => new TextLoader(p),
    ".pdf": (p) => new PDFLoader(p),
  },
  true                 // ← recursive = true (optional)
);
const docs = await loader.load();       

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  await createPineconeIndex(pc);
  await updatePinecone(pc, docs);

  return NextResponse.json({ message: "Success: index built & populated" });
}
