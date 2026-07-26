import { z } from 'zod';
import {
  applicationStudioConfigSchema,
  type ApplicationStudioConfig,
} from './schema.js';

export type ApplicationTemplate = {
  key: string;
  name: string;
  description: string;
  config: ApplicationStudioConfig;
};

type StudioConfigInput = z.input<typeof applicationStudioConfigSchema>;

function template(
  key: string,
  name: string,
  description: string,
  config: StudioConfigInput,
): ApplicationTemplate {
  return {
    key,
    name,
    description,
    config: applicationStudioConfigSchema.parse({ ...config, templateKey: key }),
  };
}

export const APPLICATION_TEMPLATES: ApplicationTemplate[] = [
  template('general_assistant', 'General assistant', 'Broad-purpose branded chat assistant.', {
    welcomeMessage: 'Ask me anything — I am ready to help.',
    starterPrompts: ['What can you do?', 'Summarize this for me', 'Draft a response'],
    theme: { primaryColor: '#0F766E', backgroundColor: '#F8FAFC' },
  }),
  template(
    'internal_knowledge_copilot',
    'Internal knowledge copilot',
    'Internal help desk grounded in org knowledge.',
    {
      welcomeMessage: 'Search internal knowledge and get concise answers.',
      starterPrompts: ['Where is the onboarding guide?', 'What is our PTO policy?', 'Who owns billing?'],
      theme: { primaryColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
      featureFlags: { fileUpload: true, userFeedback: true },
      authenticationMode: 'platform_session',
    },
  ),
  template('developer_composer', 'Developer composer', 'Coding and implementation assistant.', {
    welcomeMessage: 'Describe the change you want and I will help compose it.',
    starterPrompts: ['Explain this stack trace', 'Draft an API handler', 'Write unit tests'],
    theme: { primaryColor: '#7C3AED', backgroundColor: '#FAF5FF', fontFamily: 'IBM Plex Mono, monospace' },
    chatLayout: 'full',
    featureFlags: { artifactPreview: true, fileUpload: true },
  }),
  template(
    'customer_support_assistant',
    'Customer-support assistant',
    'Customer-facing support with escalation-friendly tone.',
    {
      welcomeMessage: 'Hi — how can we help you today?',
      starterPrompts: ['Track my order', 'Reset my password', 'Talk to a human'],
      theme: { primaryColor: '#B45309', backgroundColor: '#FFFBEB' },
      featureFlags: { userFeedback: true, showBrandingFooter: true },
      supportContact: 'support@example.com',
    },
  ),
  template(
    'data_analysis_workspace',
    'Data-analysis workspace',
    'Explore datasets and produce analytical summaries.',
    {
      welcomeMessage: 'Upload context or ask an analytical question.',
      starterPrompts: ['Describe trends', 'Find anomalies', 'Propose a chart'],
      theme: { primaryColor: '#0E7490', backgroundColor: '#ECFEFF' },
      featureFlags: { fileUpload: true, artifactPreview: true },
      chatLayout: 'full',
    },
  ),
  template(
    'guided_workflow_assistant',
    'Guided workflow assistant',
    'Step-by-step workflow coach for structured tasks.',
    {
      welcomeMessage: 'Let’s walk through the workflow one step at a time.',
      starterPrompts: ['Start the workflow', 'What is the next step?', 'Show checklist'],
      theme: { primaryColor: '#15803D', backgroundColor: '#F0FDF4' },
      navigationLabel: 'Workflow',
      featureFlags: { showStarterPrompts: true, userFeedback: true },
    },
  ),
];

export function listApplicationTemplates(): ApplicationTemplate[] {
  return APPLICATION_TEMPLATES;
}

export function getApplicationTemplate(key: string): ApplicationTemplate | undefined {
  return APPLICATION_TEMPLATES.find((t) => t.key === key);
}
