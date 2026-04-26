import { aiOrchestratorService } from "../../aiPipeline/aiOrchestrator.service";

export const stage2Extraction = aiOrchestratorService.extractAndMapDocumentFields.bind(aiOrchestratorService);
