export const PUBLICATION_CHANNELS = ['hosted_web', 'embed', 'api', 'desktop'] as const;

export type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

export function isPublicationChannel(value: string): value is PublicationChannel {
  return (PUBLICATION_CHANNELS as readonly string[]).includes(value);
}

export function assertPublicationChannel(value: string): PublicationChannel {
  if (!isPublicationChannel(value)) {
    throw new Error(`Invalid publication channel: ${value}`);
  }
  return value;
}
