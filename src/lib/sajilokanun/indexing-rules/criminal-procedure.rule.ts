import type { IndexingRule } from "./types";
import { DEFAULT_NEPALI_LAW_CHUNKING } from "./default-chunking";

/** Reusable indexing rule for मुलुकी फौजदारी कार्यविधि संहिता, २०७४ */
export const CRIMINAL_PROCEDURE_INDEXING_RULE: IndexingRule = {
  id: "criminal-procedure",
  match: [
    /मुलुकी[_\s]फौजदारी.*कार्यविधि/i,
    /फौजदारी.*कार्यविधि.*२०७४/i,
    /lawComission\/मुलुकी[_\s]फौजदारी/i,
  ],
  sourceText: "lawComission/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.txt",
  ingestFilename: "lawComission/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.txt",
  replaceDocumentFilenames: [
    "lawComission/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.txt",
    "lawComission/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.pdf",
    "refined/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.pdf",
    "मुलुकी_फौजदारी_कार्यविधि_संहिता,_२०७४.pdf",
  ],
  documentTitle: "मुलुकी फौजदारी कार्यविधि संहिता, २०७४",
  documentCategory: "प्रक्रियात्मक कानून (Procedural Law)",
  bookId: "criminal-procedure",
  chunking: DEFAULT_NEPALI_LAW_CHUNKING,
};
