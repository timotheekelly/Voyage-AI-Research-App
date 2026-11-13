// Usage: mongosh "$MONGODB_URI" --file atlas/create-indexes.js   (run from the server/ directory)
// Creates the two Atlas indexes the application needs on document_chunks. Safe to read before running.
const fs = require("fs");
const dbName = process.env.MONGODB_DATABASE || "research_intelligence";
const target = db.getSiblingDB(dbName);

target.createCollection("document_chunks"); // search indexes need the collection to exist (no-op error if it does)
for (const file of ["atlas/chunk_vector_index.json", "atlas/chunk_text_index.json"]) {
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));
  print(`Creating ${spec.type} index '${spec.name}' ...`);
  target.document_chunks.createSearchIndex(spec.name, spec.type, spec.definition);
}
print("Done. Wait until both indexes show queryable: true:");
print(`  db.getSiblingDB('${dbName}').document_chunks.aggregate([{ $listSearchIndexes: {} }])`);
