/** Future providers must return suggestions; users explicitly confirm vocabulary changes. */
export interface LearningAIProvider {
 suggestExpression(input:{text:string;skill:'writing'|'speaking'}):Promise<{suggestions:string[];provider:string}>;
 transcribe?(audio:Blob):Promise<string>;
}
