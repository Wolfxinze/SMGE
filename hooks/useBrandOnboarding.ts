import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './useSession';

interface OnboardingFormData {
  // Step 1: Basic Information
  basicInfo: {
    name: string;
    industry: string;
    description?: string;
    website?: string;
  };

  // Step 2: Brand Identity
  brandIdentity: {
    primaryColor?: string;
    secondaryColor?: string;
    targetAudiences?: Array<{
      name: string;
      demographics?: Record<string, any>;
      interests?: string[];
    }>;
  };

  // Step 3: Voice & Tone
  voiceTone: {
    tone?: string[];
    writing_style?: string[];
    keywords?: string[];
    avoid_phrases?: string[];
    description?: string;
  };

  // Step 4: Content Examples
  contentExamples: {
    examples?: Array<{
      content: string;
      platform: string;
      metrics?: {
        engagement?: number;
        reach?: number;
      };
    }>;
  };

  // Step 5: Guidelines
  guidelines: {
    rules?: Array<{
      type: 'visual' | 'content' | 'tone' | 'legal' | 'other';
      title: string;
      description: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    }>;
  };
}

export function useBrandOnboarding() {
  const router = useRouter();
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState<OnboardingFormData>({
    basicInfo: {
      name: '',
      industry: '',
      description: '',
      website: '',
    },
    brandIdentity: {
      primaryColor: '',
      secondaryColor: '',
      targetAudiences: [],
    },
    voiceTone: {
      tone: [],
      writing_style: [],
      keywords: [],
      avoid_phrases: [],
      description: '',
    },
    contentExamples: {
      examples: [],
    },
    guidelines: {
      rules: [],
    },
  });

  const updateFormData = (step: keyof OnboardingFormData, data: any) => {
    setFormData(prev => ({
      ...prev,
      [step]: { ...prev[step], ...data },
    }));
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const submitForm = async () => {
    if (!user) {
      setError('You must be logged in to create a brand');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create the brand
      const brandRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.basicInfo.name,
          description: formData.basicInfo.description,
          website_url: formData.basicInfo.website,
          industry: formData.basicInfo.industry,
          primary_color: formData.brandIdentity.primaryColor,
          secondary_color: formData.brandIdentity.secondaryColor,
        }),
      });

      if (!brandRes.ok) {
        throw new Error('Failed to create brand');
      }

      const brand = await brandRes.json();

      // 2. Create target audiences
      if (formData.brandIdentity.targetAudiences && formData.brandIdentity.targetAudiences.length > 0) {
        for (const audience of formData.brandIdentity.targetAudiences) {
          await fetch(`/api/brands/${brand.id}/audiences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(audience),
          });
        }
      }

      // 3. Update brand voice configuration
      if (formData.voiceTone.tone && formData.voiceTone.tone.length > 0) {
        await fetch(`/api/brands/${brand.id}/voice`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tone: formData.voiceTone.tone,
            writing_style: formData.voiceTone.writing_style,
            keywords: formData.voiceTone.keywords,
            avoid_phrases: formData.voiceTone.avoid_phrases,
          }),
        });
      }

      // 4. Create brand guidelines
      if (formData.guidelines.rules && formData.guidelines.rules.length > 0) {
        for (const rule of formData.guidelines.rules) {
          await fetch(`/api/brands/${brand.id}/guidelines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule),
          });
        }
      }

      // 5. Create content examples WITH embeddings (FIX for Critical Issue #1)
      if (formData.contentExamples.examples && formData.contentExamples.examples.length > 0) {
        for (const example of formData.contentExamples.examples) {
          try {
            // Generate embedding for content
            const embeddingRes = await fetch('/api/ai/embeddings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: example.content }),
            });

            if (!embeddingRes.ok) {
              console.error('Failed to generate embedding for example');
              continue;
            }

            const { embedding } = await embeddingRes.json();

            // Create content example with embedding
            await fetch(`/api/brands/${brand.id}/content`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content_type: 'post',
                platform: example.platform,
                content_text: example.content,
                embedding: embedding,
                performance_score: example.metrics?.engagement || 0,
                engagement_metrics: example.metrics,
              }),
            });
          } catch (error) {
            console.error('Failed to create content example:', error);
          }
        }
      }

      // 6. Generate brand voice embedding (FIX for Critical Issue #1)
      if (formData.voiceTone.tone && formData.voiceTone.tone.length > 0) {
        try {
          // Combine voice attributes into text for embedding
          const voiceText = [
            ...formData.voiceTone.tone,
            ...formData.voiceTone.writing_style || [],
            formData.voiceTone.description || '',
            ...formData.voiceTone.keywords || [],
          ].filter(Boolean).join(' ');

          const embeddingRes = await fetch('/api/ai/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: voiceText }),
          });

          if (embeddingRes.ok) {
            const { embedding } = await embeddingRes.json();

            // Update brand voice with embedding
            await fetch(`/api/brands/${brand.id}/voice`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ voice_embedding: embedding }),
            });
          }
        } catch (error) {
          console.error('Failed to generate voice embedding:', error);
        }
      }

      // 7. Trigger initial training if we have examples
      if (formData.contentExamples.examples && formData.contentExamples.examples.length > 0) {
        try {
          await fetch(`/api/brands/${brand.id}/voice/train`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              use_existing_examples: true,
              min_performance_score: 0,
            }),
          });
        } catch (error) {
          console.error('Failed to trigger initial training:', error);
        }
      }

      // Navigate to the new brand's dashboard
      router.push(`/brands/${brand.id}`);
    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    updateFormData,
    currentStep,
    nextStep,
    previousStep,
    submitForm,
    isSubmitting,
    error,
    totalSteps: 5,
  };
}