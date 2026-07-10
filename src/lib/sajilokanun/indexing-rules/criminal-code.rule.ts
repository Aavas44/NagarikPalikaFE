import type { IndexingRule } from "./types";
import { DEFAULT_NEPALI_LAW_CHUNKING } from "./default-chunking";

/** Reusable indexing rule for मुलुकी अपराध संहिता, २०७४ */
export const CRIMINAL_CODE_INDEXING_RULE: IndexingRule = {
  id: "criminal-code",
  match: [
    /मुलुकी[_\s]अपराध.*संहिता/i,
    /अपराध.*संहिता.*२०७४/i,
    /lawComission\/मुलुकी[_\s]अपराध/i,
    /मलुकु\s*ी\s*अपराध/i,
  ],
  sourceText: "lawComission/मुलुकी अपराध संहिता, २०७४.txt",
  ingestFilename: "lawComission/मुलुकी अपराध संहिता, २०७४.txt",
  replaceDocumentFilenames: [
    "lawComission/मुलुकी अपराध संहिता, २०७४.txt",
    "lawComission/मलुकु ी अपराध संहिता, २०७४.txt",
    "lawComission/मुलुकी अपराध संहिता, २०७४.pdf",
    "refined/मुलुकी अपराध संहिता, २०७४.pdf",
    "मुलुकी-अपराध-संहिता-ऐन-२०७४.pdf",
  ],
  documentTitle: "मुलुकी अपराध संहिता, २०७४",
  documentCategory: "सारभूत कानून (Substantive Law)",
  bookId: "criminal-code",
  chunking: DEFAULT_NEPALI_LAW_CHUNKING,
};
