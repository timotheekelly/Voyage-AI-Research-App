import { UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { ACCEPTED_EXTENSIONS } from "../../hooks/useDocuments";

interface Props {
  onFiles: (files: File[]) => void;
}

export function DocumentUpload({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      data-testid="dropzone"
      className={`flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
        dragging ? "border-accent bg-accent-soft/50" : "border-line bg-surface"
      }`}
    >
      <UploadCloud className="h-5 w-5 text-muted" aria-hidden="true" />
      <p className="text-sm">
        Drag documents here, or{" "}
        <button type="button" className="font-medium text-accent underline underline-offset-2" onClick={() => inputRef.current?.click()}>
          browse files
        </button>
      </p>
      <p className="text-xs text-muted">{ACCEPTED_EXTENSIONS.join(", ")} · up to 50 MB</p>
      <label htmlFor="document-file-input" className="sr-only">
        Upload documents
      </label>
      <input
        id="document-file-input"
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
