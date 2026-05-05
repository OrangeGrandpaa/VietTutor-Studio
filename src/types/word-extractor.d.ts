declare module "word-extractor" {
  class ExtractedWordDocument {
    getBody(): string;
  }

  export default class WordExtractor {
    extract(input: string | Buffer): Promise<ExtractedWordDocument>;
  }
}
