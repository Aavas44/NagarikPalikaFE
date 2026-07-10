/**
 * Convert a lawComission .txt exported in Preeti/Kantipur font encoding to Unicode Devanagari.
 *
 * Usage:
 *   tsx scripts/convert-legacy-txt.ts "Lawfiles/lawComission/मलुकु ी अपराध संहिता, २०७४.txt"
 *   tsx scripts/convert-legacy-txt.ts input.txt output.txt
 */
import fs from "fs";
import path from "path";
import {
  convertLegacyTextFile,
  devanagariRatio,
} from "../../src/lib/sajilokanun/pdf-extract";

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error(
      "Usage: tsx scripts/convert-legacy-txt.ts <input.txt> [output.txt]"
    );
    process.exit(1);
  }

  const inputPath = path.isAbsolute(inputArg)
    ? inputArg
    : path.join(process.cwd(), inputArg);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const beforeRatio = devanagariRatio(raw);
  const converted = convertLegacyTextFile(raw);
  const afterRatio = devanagariRatio(converted);

  const defaultOut = inputPath.replace(
    /मलुकु\s*ी|d'n'sL/i,
    "मुलुकी"
  );
  const outputPath =
    process.argv[3] != null
      ? path.isAbsolute(process.argv[3])
        ? process.argv[3]
        : path.join(process.cwd(), process.argv[3])
      : defaultOut !== inputPath
        ? defaultOut
        : path.join(
            path.dirname(inputPath),
            path.basename(inputPath, ".txt") + ".unicode.txt"
          );

  fs.writeFileSync(outputPath, converted, "utf-8");

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(
    `Devanagari ratio: ${(beforeRatio * 100).toFixed(1)}% → ${(afterRatio * 100).toFixed(1)}%`
  );
  console.log(`Lines: ${converted.split("\n").length}`);
}

main();
