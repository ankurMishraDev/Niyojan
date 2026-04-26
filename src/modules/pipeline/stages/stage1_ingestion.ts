import { buildInitialRoutingManifest } from "../routingManifest";

export const stage1Ingestion = (documentId: string) => {
	return buildInitialRoutingManifest({ documentId });
};
