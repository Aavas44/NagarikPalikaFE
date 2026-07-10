import type { IndexingRule } from "./types";
import { DEFAULT_NEPALI_LAW_CHUNKING } from "./default-chunking";

/** Reusable indexing rule for मुलुकी देवानी कार्यविधि, २०७४ */
export const CIVIL_PROCEDURE_INDEXING_RULE: IndexingRule = {
  id: "civil-procedure",
  match: [
    /मुलुकी[_\s]देवानी.*कार्यविधि/i,
    /देवानी.*कार्यविधि.*२०७४/i,
    /lawComission\/मुलुकी[_\s]देवानी.*कार्यविधि/i,
  ],
  sourceText: "lawComission/मुलुकी देवानी कार्यविधि (संहिता), २०७४.txt",
  ingestFilename: "lawComission/मुलुकी देवानी कार्यविधि (संहिता), २०७४.txt",
  replaceDocumentFilenames: [
    "lawComission/मुलुकी देवानी कार्यविधि (संहिता), २०७४.txt",
    "lawComission/मुलुकी देवानी कार्यविधि संहिता, २०७४.pdf",
    "lawComission/मुलुकी देवानी कार्यविधि संहिता, २०७४.txt",
    "मुलुकी_देवानी_कार्यविधि_संहिता,_२०७४.pdf",
  ],
  documentTitle: "मुलुकी देवानी कार्यविधि, २०७४",
  documentCategory: "प्रक्रियात्मक कानून (Procedural Law)",
  bookId: "civil-procedure",
  chunking: DEFAULT_NEPALI_LAW_CHUNKING,
};
