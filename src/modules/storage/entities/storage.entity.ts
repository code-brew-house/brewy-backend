/**
 * Storage entity representing a file record in the storage table.
 */
export class Storage {
  /** Unique identifier for the storage record */
  id: string;

  /** Public URL of the file in R2 */
  url: string;

  /** Original filename of the uploaded file */
  filename: string;

  /** Size of the file in bytes */
  size: number;

  /** MIME type of the file (e.g., 'audio/mpeg') */
  mimetype: string;

  /** Timestamp when the file was uploaded */
  timestamp: Date;
}
