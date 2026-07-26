import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let provider: BasicTracerProvider | undefined;

export function initOpenTelemetry(input: {
  serviceName: string;
  otlpEndpoint?: string;
}) {
  if (provider) return provider;

  provider = new BasicTracerProvider({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: input.serviceName,
    }),
  });

  if (input.otlpEndpoint) {
    provider.addSpanProcessor(
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: input.otlpEndpoint,
        }),
      ),
    );
  } else if (process.env.OTEL_DEBUG === 'true') {
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  trace.setGlobalTracerProvider(provider);
  return provider;
}

export function getTracer(name = 'agent-studio-api') {
  return trace.getTracer(name);
}
