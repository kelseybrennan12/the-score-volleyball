export interface BlobUploadInput {
  containerName: string;
  blobKey: string;
  content: Buffer;
  contentType: string;
}

export interface BlobUploadResult {
  url: string;
  container: string;
  key: string;
}

export interface BlobDownloadInput {
  containerName: string;
  blobKey: string;
}

export interface BlobDownloadResult {
  content: Buffer;
  contentType: string;
  contentLength: number;
}

export interface BlobStoragePort {
  uploadBlob(input: BlobUploadInput): Promise<BlobUploadResult>;
  downloadBlob(input: BlobDownloadInput): Promise<BlobDownloadResult>;
}
