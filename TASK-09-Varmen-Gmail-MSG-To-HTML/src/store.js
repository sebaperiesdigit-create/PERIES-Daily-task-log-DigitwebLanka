import fs from "node:fs";
import path from "node:path";

/**
 * Minimal, dependency-free local JSON store for loan-request records.
 *
 * Records are keyed by their stable `sourceId` (the simulated Gmail message id),
 * so re-processing the same source id always overwrites the same slot instead of
 * appending a duplicate. This is the "smallest safe local store" for the first
 * delivery - not a stand-in for the future Varmen database.
 */
export class Store {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }
    const raw = fs.readFileSync(this.filePath, "utf8").trim();
    if (raw.length === 0) return {};
    return JSON.parse(raw);
  }

  save(records) {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2) + "\n", "utf8");
  }

  /** Upserts one record by sourceId. Idempotent: rerunning the same source id never duplicates. */
  upsert(record) {
    const records = this.load();
    records[record.sourceId] = record;
    this.save(records);
    return records;
  }

  /** Upserts many records in one read/write cycle. */
  upsertAll(recordList) {
    const records = this.load();
    for (const record of recordList) {
      records[record.sourceId] = record;
    }
    this.save(records);
    return records;
  }

  list() {
    return Object.values(this.load());
  }
}
