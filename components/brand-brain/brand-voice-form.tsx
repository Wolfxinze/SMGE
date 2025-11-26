/**
 * Brand Voice Form Component
 * Configure brand voice settings for AI content generation
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface BrandVoiceFormProps {
  brandId: string;
}

export function BrandVoiceForm({ brandId }: BrandVoiceFormProps) {
  const [isLoading] = useState(false);

  // Brand ID will be used in future implementation
  console.log('Brand ID:', brandId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Settings</CardTitle>
        <CardDescription>
          Define your brand's tone, style, and communication preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <p className="text-muted-foreground">
            Brand voice configuration coming soon
          </p>
          <Button disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}