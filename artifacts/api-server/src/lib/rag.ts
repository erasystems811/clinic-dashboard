import OpenAI from "openai";
import { supabase } from "./supabase.js";

const EMBED_MODEL = "text-embedding-3-small";
const CHUNK_SIZE  = 800;   // characters per chunk
const CHUNK_OVERLAP = 100;
const TOP_K       = 5;     // chunks to retrieve per query

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: key });
}

// ── Chunking ──────────────────────────────────────────────────────────────────
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.trim().length > 50);
}

// ── Embed a single string ─────────────────────────────────────────────────────
export async function embed(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: text.slice(0, 8000) });
  return res.data[0]!.embedding;
}

// ── Store a document (chunks + embeddings) ────────────────────────────────────
export async function storeDocument(opts: {
  title: string;
  category: "weightloss" | "psychology" | "nutrition" | "fitness" | "general";
  source?: string;
  content: string;
  uploadedBy?: string;
}): Promise<{ chunks: number }> {
  const chunks = chunkText(opts.content);

  // Embed all chunks (sequential to stay within rate limits)
  const rows: Array<{
    title: string; category: string; source: string | null;
    chunk_index: number; content: string; embedding: string; uploaded_by: string | null;
  }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embed(chunks[i]!);
    rows.push({
      title: opts.title,
      category: opts.category,
      source: opts.source ?? null,
      chunk_index: i,
      content: chunks[i]!,
      // Supabase pgvector expects a string "[x,y,z,...]"
      embedding: `[${embedding.join(",")}]`,
      uploaded_by: opts.uploadedBy ?? null,
    });
  }

  const { error } = await supabase.from("rag_documents").insert(rows);
  if (error) throw new Error(`RAG store failed: ${error.message}`);
  return { chunks: chunks.length };
}

// ── Retrieve relevant chunks for a query ─────────────────────────────────────
export async function retrieve(
  query: string,
  category: "weightloss" | "psychology" | "nutrition" | "fitness" | "general" | "any",
  topK = TOP_K,
): Promise<string[]> {
  try {
    const queryEmbedding = await embed(query);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Use pgvector cosine similarity via Supabase RPC
    const { data, error } = await supabase.rpc("rag_search", {
      query_embedding: embeddingStr,
      match_category: category === "any" ? null : category,
      match_count: topK,
    });

    if (error || !data) return [];
    return (data as Array<{ content: string }>).map((r) => r.content);
  } catch {
    // RAG is best-effort — never break the main response
    return [];
  }
}

// ── Build context string from retrieved chunks ────────────────────────────────
export async function buildRagContext(
  query: string,
  category: "weightloss" | "psychology" | "nutrition" | "fitness" | "general" | "any",
): Promise<string> {
  const chunks = await retrieve(query, category);
  if (chunks.length === 0) return "";
  return `\n\n--- Additional knowledge (use naturally, do not quote verbatim) ---\n${chunks.join("\n\n---\n")}\n---`;
}
