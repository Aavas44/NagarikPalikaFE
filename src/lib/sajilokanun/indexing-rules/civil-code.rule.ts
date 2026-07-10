import type { IndexingRule } from "./types";
import { DEFAULT_NEPALI_LAW_CHUNKING } from "./default-chunking";

/** Reusable indexing rule for मुलुकी देवानी संहिता, २०७४ */
export const CIVIL_CODE_INDEXING_RULE: IndexingRule = {
  id: "civil-code",
  match: [
    /मुलुकी[_\s]देवानी.*संहिता/i,
    /देवानी.*संहिता.*२०७४/i,
    /lawComission\/मुलुकी[_\s]देवानी.*संहिता/i,
  ],
  sourceText: "lawComission/मुलुकी देवानी संहिता, २०७४.txt",
  ingestFilename: "lawComission/मुलुकी देवानी संहिता, २०७४.txt",
  replaceDocumentFilenames: [
    "lawComission/मुलुकी देवानी संहिता, २०७४.txt",
    "lawComission/मुलुकी देवानी संहिता, २०७४.pdf",
    "lawComission/मुलुकी_देवानी_(संहिता) ऐन,_२०७४.pdf",
    "मुलुकी_देवानी_(संहिता) ऐन,_२०७४.pdf",
    "refined/मुलुकी_देवानी_(संहिता) ऐन,२०७४.pdf",
  ],
  documentTitle: "मुलुकी देवानी संहिता, २०७४",
  documentCategory: "सारभूत कानून (Substantive Law)",
  bookId: "civil-code",
  chunking: DEFAULT_NEPALI_LAW_CHUNKING,
};
