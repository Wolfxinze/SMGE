import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './embeddings';
import type { SimilaritySearchResult } from '@/lib/brand-brain/types';

/**
 * Search for similar brand voices
 */
export async function searchSimilarVoices(
  brandId: string,
  query: string,
  limit = 5,
  threshold = 0.7
): Promise<SimilaritySearchResult[]> {
  const supabase = await createClient();

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Call the RPC function with the embedding array directly (FIX for Critical Issue #5)
    const { data, error } = await supabase.rpc('search_similar_voice', {
      query_embedding: embedding, // Pass array directly, not as string
      brand_id_filter: brandId,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Voice search error:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      content_text: item.content_text || '',
      similarity_score: item.similarity,
      platform: item.platform,
      performance_score: item.performance_score,
    }));
  } catch (error) {
    console.error('Failed to search similar voices:', error);
    throw new Error('Voice search failed');
  }
}

/**
 * Search for similar content examples
 */
export async function searchSimilarContent(
  brandId: string,
  query: string,
  limit = 10,
  threshold = 0.6
): Promise<SimilaritySearchResult[]> {
  const supabase = await createClient();

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Call the RPC function with the embedding array directly (FIX for Critical Issue #5)
    const { data, error } = await supabase.rpc('search_similar_content', {
      query_embedding: embedding, // Pass array directly, not as string
      brand_id_filter: brandId,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Content search error:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      content_text: item.content_text,
      similarity_score: item.similarity,
      platform: item.platform,
      performance_score: item.performance_score,
    }));
  } catch (error) {
    console.error('Failed to search similar content:', error);
    throw new Error('Content search failed');
  }
}

/**
 * Search across all brands for similar content
 */
export async function searchGlobalContent(
  query: string,
  userId: string,
  limit = 20,
  threshold = 0.5
): Promise<Array<SimilaritySearchResult & { brand_name: string }>> {
  const supabase = await createClient();

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Call the RPC function with the embedding array directly (FIX for Critical Issue #5)
    const { data, error } = await supabase.rpc('search_global_content', {
      query_embedding: embedding, // Pass array directly, not as string
      user_id_filter: userId,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Global content search error:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      content_text: item.content_text,
      similarity_score: item.similarity,
      platform: item.platform,
      performance_score: item.performance_score,
      brand_name: item.brand_name,
    }));
  } catch (error) {
    console.error('Failed to search global content:', error);
    throw new Error('Global content search failed');
  }
}

/**
 * Find content examples that match brand voice
 */
export async function findVoiceMatchingContent(
  brandId: string,
  limit = 10
): Promise<SimilaritySearchResult[]> {
  const supabase = await createClient();

  try {
    // Get brand voice embedding
    const { data: voiceData, error: voiceError } = await supabase
      .from('brand_voice')
      .select('voice_embedding')
      .eq('brand_id', brandId)
      .single();

    if (voiceError || !voiceData?.voice_embedding) {
      throw new Error('Brand voice not found or not trained');
    }

    // Search for similar content using the voice embedding
    const { data, error } = await supabase.rpc('search_similar_content', {
      query_embedding: voiceData.voice_embedding, // Pass array directly (FIX for Critical Issue #5)
      brand_id_filter: brandId,
      match_threshold: 0.7,
      match_count: limit,
    });

    if (error) {
      console.error('Voice matching search error:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      content_text: item.content_text,
      similarity_score: item.similarity,
      platform: item.platform,
      performance_score: item.performance_score,
    }));
  } catch (error) {
    console.error('Failed to find voice matching content:', error);
    throw new Error('Voice matching search failed');
  }
}