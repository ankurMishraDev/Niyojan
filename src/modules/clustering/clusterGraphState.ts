import { Annotation } from "@langchain/langgraph";

export const ClusterStateAnnotation = Annotation.Root({
  orgId: Annotation<string>(),
  userId: Annotation<string>(),
  needs: Annotation<any[]>(),
  policy: Annotation<any>(),
  candidateClusters: Annotation<any[]>({
    reducer: (old, newVals) => newVals,
    default: () => [],
  }),
  confirmedClusterId: Annotation<string>(),
  aggregateSummary: Annotation<{ title: string; description: string; urgencyLabel: string; urgencyScore: number; } | null>({
    reducer: (old, newVals) => newVals,
    default: () => null,
  }),
  status: Annotation<string>({
    reducer: (old, newVal) => newVal,
    default: () => "started",
  }),
});

export type ClusterState = typeof ClusterStateAnnotation.State;
