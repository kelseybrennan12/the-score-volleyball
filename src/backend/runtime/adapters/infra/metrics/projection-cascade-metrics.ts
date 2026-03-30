import { ValueType } from "@opentelemetry/api";
import { getMeter } from "backend/runtime/adapters/infra/telemetry";

export interface ProjectionCascadeMetrics {
  recordRoot(input: {
    rootProjector: string;
    trigger: string;
    outcome: "completed" | "failed";
    durationMs: number;
  }): void;
  recordStep(input: {
    rootProjector: string;
    projectorName: string;
    trigger: string;
    outcome: "completed" | "failed";
    durationMs: number;
  }): void;
}

export const createProjectionCascadeMetrics = (): ProjectionCascadeMetrics => {
  const meter = getMeter("starter-projection-cascade");
  const rootDuration = meter.createHistogram("starter_projection_cascade_root_duration_ms", {
    description: "Total duration for inline projector cascades",
    valueType: ValueType.DOUBLE,
    unit: "ms",
  });
  const stepDuration = meter.createHistogram("starter_projection_cascade_step_duration_ms", {
    description: "Per-step duration for inline projector cascades",
    valueType: ValueType.DOUBLE,
    unit: "ms",
  });
  const failures = meter.createCounter("starter_projection_cascade_failures", {
    description: "Total failed inline projector cascade roots and steps",
    valueType: ValueType.INT,
  });

  return {
    recordRoot: ({ rootProjector, trigger, outcome, durationMs }) => {
      rootDuration.record(durationMs, {
        root_projector: rootProjector,
        trigger,
        outcome,
      });
      if (outcome === "failed") {
        failures.add(1, {
          root_projector: rootProjector,
          trigger,
          phase: "root",
        });
      }
    },
    recordStep: ({ rootProjector, projectorName, trigger, outcome, durationMs }) => {
      stepDuration.record(durationMs, {
        root_projector: rootProjector,
        projector_name: projectorName,
        trigger,
        outcome,
      });
      if (outcome === "failed") {
        failures.add(1, {
          root_projector: rootProjector,
          projector_name: projectorName,
          trigger,
          phase: "step",
        });
      }
    },
  };
};
