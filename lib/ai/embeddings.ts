import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for a text string using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('Text is required for embedding generation');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw new Error('Embedding generation failed');
  }
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw new Error('Embeddings generation failed');
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Calculate weighted average of embeddings
 */
export function weightedAverageEmbedding(
  embeddings: number[][],
  weights?: number[]
): number[] {
  if (embeddings.length === 0) {
    throw new Error('At least one embedding is required');
  }

  const dimension = embeddings[0].length;
  const result = new Array(dimension).fill(0);

  // Use equal weights if not provided
  const effectiveWeights = weights || new Array(embeddings.length).fill(1 / embeddings.length);

  // Normalize weights
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = effectiveWeights.map(w => w / totalWeight);

  // Calculate weighted average
  for (let i = 0; i < embeddings.length; i++) {
    const embedding = embeddings[i];
    const weight = normalizedWeights[i];

    for (let j = 0; j < dimension; j++) {
      result[j] += embedding[j] * weight;
    }
  }

  return result;
}

/**
 * Find most similar embeddings
 */
export function findMostSimilar(
  queryEmbedding: number[],
  candidateEmbeddings: Array<{ id: string; embedding: number[] }>,
  limit = 10,
  threshold = 0
): Array<{ id: string; similarity: number }> {
  const similarities = candidateEmbeddings.map(candidate => ({
    id: candidate.id,
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
  }));

  return similarities
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}