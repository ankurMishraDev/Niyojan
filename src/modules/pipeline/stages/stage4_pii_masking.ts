export const stage4PiiMasking = (canonicalText: string) => {
	const tokenCount = canonicalText.split(/\s+/).filter(Boolean).length;
	return {
		dlpFindingsCount: 0,
		dlpInfoTypesFound: [],
		softPiiFindingsCount: 0,
		gcsTokenMapPath: null,
		inlineTokenMap: [],
		tokenizedText: canonicalText,
		originalTokenCount: tokenCount,
		remainingTokenCount: tokenCount,
		semanticLossRatio: 0,
	};
};
