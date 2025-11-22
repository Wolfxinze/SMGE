/**
 * n8n Client
 * Helper utilities for interacting with n8n workflows from Next.js
 */

import {
  N8NClientConfig,
  N8NApiResponse,
  WorkflowTriggerPayload,
  WorkflowTriggerResponse,
  N8NExecution,
  N8NWorkflow,
  WorkflowExecutionStatus,
  SMGEWorkflows
} from './types';

/**
 * n8n API Client
 * Provides methods to interact with n8n workflows
 */
export class N8NClient {
  private config: N8NClientConfig;
  private headers: Headers;

  constructor(config?: Partial<N8NClientConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || process.env.N8N_URL || 'http://localhost:5678',
      apiKey: config?.apiKey || process.env.N8N_API_KEY,
      webhookSecret: config?.webhookSecret || process.env.N8N_WEBHOOK_SECRET,
      timeout: config?.timeout || 30000,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 1000
    };

    this.headers = new Headers({
      'Content-Type': 'application/json',
      ...(this.config.apiKey && { 'X-N8N-API-KEY': this.config.apiKey })
    });
  }

  /**
   * Make HTTP request to n8n API with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<N8NApiResponse<T>> {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < (this.config.retryAttempts || 3); attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          headers: { ...this.headers, ...options.headers },
          signal: controller.signal
        });

        clearTimeout(timeout);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}`);
        }

        return {
          success: true,
          data: data as T,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          break;
        }

        // Wait before retrying
        if (attempt < (this.config.retryAttempts || 3) - 1) {
          await this.delay(this.config.retryDelay || 1000);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Trigger a workflow execution
   */
  async triggerWorkflow(payload: WorkflowTriggerPayload): Promise<WorkflowTriggerResponse | null> {
    const response = await this.request<WorkflowTriggerResponse>(
      `/workflows/${payload.workflowId}/execute`,
      {
        method: 'POST',
        body: JSON.stringify(payload.data)
      }
    );

    if (!response.success) {
      console.error(`Failed to trigger workflow: ${response.error}`);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get workflow execution status
   */
  async getExecution(executionId: string): Promise<N8NExecution | null> {
    const response = await this.request<N8NExecution>(
      `/executions/${executionId}`,
      { method: 'GET' }
    );

    if (!response.success) {
      console.error(`Failed to get execution: ${response.error}`);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get all workflows
   */
  async getWorkflows(active?: boolean): Promise<N8NWorkflow[]> {
    const params = active !== undefined ? `?active=${active}` : '';
    const response = await this.request<N8NWorkflow[]>(
      `/workflows${params}`,
      { method: 'GET' }
    );

    if (!response.success) {
      console.error(`Failed to get workflows: ${response.error}`);
      return [];
    }

    return response.data || [];
  }

  /**
   * Wait for workflow execution to complete
   */
  async waitForExecution(
    executionId: string,
    maxWaitTime: number = 60000
  ): Promise<N8NExecution | null> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const execution = await this.getExecution(executionId);

      if (!execution) {
        return null;
      }

      if (execution.status === WorkflowExecutionStatus.SUCCESS ||
          execution.status === WorkflowExecutionStatus.ERROR ||
          execution.status === WorkflowExecutionStatus.CANCELED) {
        return execution;
      }

      await this.delay(checkInterval);
    }

    console.error(`Execution ${executionId} timed out after ${maxWaitTime}ms`);
    return null;
  }

  /**
   * SMGE-specific workflow triggers
   */
  async generateContent(
    payload: SMGEWorkflows.ContentGenerationPayload
  ): Promise<SMGEWorkflows.ContentGenerationResponse | null> {
    const workflowId = process.env.N8N_WORKFLOW_CONTENT_GENERATION;

    if (!workflowId) {
      console.error('Content generation workflow ID not configured');
      return null;
    }

    const result = await this.triggerWorkflow({
      workflowId,
      data: payload
    });

    if (!result) {
      return null;
    }

    // Wait for execution to complete
    const execution = await this.waitForExecution(result.executionId);

    if (!execution || execution.status !== WorkflowExecutionStatus.SUCCESS) {
      return null;
    }

    return execution.data as SMGEWorkflows.ContentGenerationResponse;
  }

  async analyzeBrand(
    payload: SMGEWorkflows.BrandAnalysisPayload
  ): Promise<SMGEWorkflows.BrandAnalysisResponse | null> {
    const workflowId = process.env.N8N_WORKFLOW_BRAND_ANALYSIS;

    if (!workflowId) {
      console.error('Brand analysis workflow ID not configured');
      return null;
    }

    const result = await this.triggerWorkflow({
      workflowId,
      data: payload
    });

    if (!result) {
      return null;
    }

    const execution = await this.waitForExecution(result.executionId);

    if (!execution || execution.status !== WorkflowExecutionStatus.SUCCESS) {
      return null;
    }

    return execution.data as SMGEWorkflows.BrandAnalysisResponse;
  }

  async schedulePost(
    payload: SMGEWorkflows.PostSchedulingPayload
  ): Promise<SMGEWorkflows.PostSchedulingResponse | null> {
    const workflowId = process.env.N8N_WORKFLOW_POST_SCHEDULING;

    if (!workflowId) {
      console.error('Post scheduling workflow ID not configured');
      return null;
    }

    const result = await this.triggerWorkflow({
      workflowId,
      data: payload
    });

    if (!result) {
      return null;
    }

    const execution = await this.waitForExecution(result.executionId);

    if (!execution || execution.status !== WorkflowExecutionStatus.SUCCESS) {
      return null;
    }

    return execution.data as SMGEWorkflows.PostSchedulingResponse;
  }

  async collectAnalytics(
    payload: SMGEWorkflows.AnalyticsCollectionPayload
  ): Promise<SMGEWorkflows.AnalyticsCollectionResponse | null> {
    const workflowId = process.env.N8N_WORKFLOW_ANALYTICS_COLLECTION;

    if (!workflowId) {
      console.error('Analytics collection workflow ID not configured');
      return null;
    }

    const result = await this.triggerWorkflow({
      workflowId,
      data: payload
    });

    if (!result) {
      return null;
    }

    const execution = await this.waitForExecution(result.executionId);

    if (!execution || execution.status !== WorkflowExecutionStatus.SUCCESS) {
      return null;
    }

    return execution.data as SMGEWorkflows.AnalyticsCollectionResponse;
  }

  async automateEngagement(
    payload: SMGEWorkflows.EngagementAutomationPayload
  ): Promise<SMGEWorkflows.EngagementAutomationResponse | null> {
    const workflowId = process.env.N8N_WORKFLOW_ENGAGEMENT_AUTOMATION;

    if (!workflowId) {
      console.error('Engagement automation workflow ID not configured');
      return null;
    }

    const result = await this.triggerWorkflow({
      workflowId,
      data: payload
    });

    if (!result) {
      return null;
    }

    const execution = await this.waitForExecution(result.executionId);

    if (!execution || execution.status !== WorkflowExecutionStatus.SUCCESS) {
      return null;
    }

    return execution.data as SMGEWorkflows.EngagementAutomationResponse;
  }
}

// Export singleton instance
export const n8nClient = new N8NClient();

// Export helper functions for direct use
export async function triggerN8NWorkflow(
  payload: WorkflowTriggerPayload
): Promise<WorkflowTriggerResponse | null> {
  return n8nClient.triggerWorkflow(payload);
}

export async function getN8NExecution(
  executionId: string
): Promise<N8NExecution | null> {
  return n8nClient.getExecution(executionId);
}

export async function waitForN8NExecution(
  executionId: string,
  maxWaitTime?: number
): Promise<N8NExecution | null> {
  return n8nClient.waitForExecution(executionId, maxWaitTime);
}