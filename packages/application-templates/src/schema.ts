import { z } from 'zod';

export const applicationThemeSchema = z.object({
  primaryColor: z.string().default('#0F766E'),
  backgroundColor: z.string().default('#F8FAFC'),
  surfaceColor: z.string().default('#FFFFFF'),
  textColor: z.string().default('#0F172A'),
  mutedTextColor: z.string().default('#475569'),
  fontFamily: z.string().default('IBM Plex Sans, sans-serif'),
  borderRadius: z.string().default('12px'),
});

export const applicationFeatureFlagsSchema = z.object({
  fileUpload: z.boolean().default(false),
  artifactPreview: z.boolean().default(true),
  voiceControls: z.boolean().default(false),
  userFeedback: z.boolean().default(true),
  showStarterPrompts: z.boolean().default(true),
  showBrandingFooter: z.boolean().default(true),
});

export const applicationStudioConfigSchema = z.object({
  templateKey: z.string().default('general_assistant'),
  logoUrl: z.string().optional().nullable(),
  theme: applicationThemeSchema.default({}),
  welcomeMessage: z.string().default('How can I help you today?'),
  starterPrompts: z.array(z.string()).default([]),
  chatLayout: z.enum(['centered', 'full']).default('centered'),
  navigationLabel: z.string().default('Assistant'),
  authenticationMode: z.enum(['platform_session', 'public_preview']).default('platform_session'),
  allowedDomains: z.array(z.string()).default([]),
  termsUrl: z.string().optional().nullable(),
  privacyUrl: z.string().optional().nullable(),
  supportContact: z.string().optional().nullable(),
  featureFlags: applicationFeatureFlagsSchema.default({}),
});

export type ApplicationTheme = z.infer<typeof applicationThemeSchema>;
export type ApplicationFeatureFlags = z.infer<typeof applicationFeatureFlagsSchema>;
export type ApplicationStudioConfig = z.infer<typeof applicationStudioConfigSchema>;

export function parseStudioConfig(input: unknown): ApplicationStudioConfig {
  return applicationStudioConfigSchema.parse(input ?? {});
}

export function publicStudioConfig(config: ApplicationStudioConfig): ApplicationStudioConfig {
  // Public surface never includes secret material; config is branding/UX only.
  return applicationStudioConfigSchema.parse(config);
}
