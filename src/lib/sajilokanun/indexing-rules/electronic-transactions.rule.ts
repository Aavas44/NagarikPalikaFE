import type { IndexingRule } from "./types";
import { DEFAULT_NEPALI_LAW_CHUNKING } from "./default-chunking";

/** विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३ */
export const ELECTRONIC_TRANSACTIONS_INDEXING_RULE: IndexingRule = {
  id: "electronic-transactions",
  match: [
    /विद्युतीय.*कारोबार.*ऐन/i,
    /इलेक्ट्रोनिक.*कारोबार/i,
    /electronic.?transactions?.?act/i,
    /eta.?2063/i,
    /lawComission\/विद्युतीय/i,
  ],
  sourceText: "lawComission/विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३.txt",
  ingestFilename: "lawComission/विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३.txt",
  replaceDocumentFilenames: [
    "lawComission/विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३.txt",
    "lawComission/.structured/विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३.txt",
    "विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३.pdf",
    "विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३.txt",
  ],
  documentTitle: "विद्युतीय (इलेक्ट्रोनिक) कारोबार ऐन, २०६३",
  documentCategory: "सारभूत कानून (Substantive Law)",
  bookId: "electronic-transactions",
  chunking: DEFAULT_NEPALI_LAW_CHUNKING,
};
