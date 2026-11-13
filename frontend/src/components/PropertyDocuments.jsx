import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Image, Plus, Trash2 } from "lucide-react";
import { adminApi } from "../api/admin.js";
import { executiveApi } from "../api/executive.js";
import { insideSalesApi } from "../api/insideSales.js";
import { outsideSalesApi } from "../api/outsideSales.js";
import { formatDate } from "../utils/apiMappers.js";

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

function formatMimeLabel(mimeType) {
  if (!mimeType) return "Document";
  const type = String(mimeType).toLowerCase();
  if (type === "application/pdf") return "PDF";
  if (type === "image/jpeg" || type === "image/jpg") return "JPEG";
  if (type === "image/png") return "PNG";
  if (type === "image/webp") return "WebP";
  return mimeType;
}

function formatFileSize(bytes) {
  if (!bytes) return "—";
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function isManageableRole(role) {
  return role === "ADMIN" || role === "EXECUTIVE";
}

export function PropertyDocuments({
  propertyId,
  role,
  user,
  onClose,
}) {
  const isManageable = isManageableRole(role);
  const api = role === "ADMIN" ? adminApi : executiveApi;
  const salesApi = role === "INSIDE_SALES" ? insideSalesApi : outsideSalesApi;

  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessLoading, setAccessLoading] = useState({});
  const [deleting, setDeleting] = useState({});
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data =
        role === "ADMIN" || role === "EXECUTIVE"
          ? await api.listDocuments(propertyId, { page, pageSize: 20 })
          : await salesApi.listDocuments(propertyId, { page, pageSize: 20 });
      setDocuments(data.documents || []);
      setPagination(data.pagination || null);
    } catch (e) {
      setError(messageFor(e));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [api, salesApi, propertyId, role, page]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleUpload(files) {
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed per upload.`);
      return;
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} exceeds ${MAX_FILE_SIZE_MB} MiB limit.`);
        return;
      }
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    setUploading(true);
    setUploadProgress(0);
    setError("");

    try {
      const data = await api.uploadDocuments(propertyId, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });
      setSuccess(
        `Uploaded ${data.documents?.length || 0} document(s) successfully.`
      );
      setUploadProgress(100);
      await loadDocuments();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleOpenDocument(document) {
    setAccessLoading({ [document.id]: true });
    try {
      const data =
        role === "ADMIN" || role === "EXECUTIVE"
          ? await api.getDocumentAccess(propertyId, document.id)
          : await salesApi.getDocumentAccess(propertyId, document.id);
      const url = data.url;
      if (url) {
        window.open(url, "_blank");
      }
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setAccessLoading({});
    }
  }

  async function handleDeleteDocument(document) {
    if (
      !window.confirm(
        `Delete "${document.documentName}"? This cannot be undone.`
      )
    )
      return;

    setDeleting({ [document.id]: true });
    setError("");
    try {
      await api.deleteDocument(propertyId, document.id);
      setSuccess(`Deleted "${document.documentName}".`);
      await loadDocuments();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setDeleting({});
    }
  }

  return (
    <div className="card property-documents-card">
      <div className="documents-header">
        <div>
          <span className="eyebrow">PROPERTY DOCUMENTS</span>
          <h2>Documents</h2>
          <p className="muted">
            Manage files for property #{propertyId}. PDF, JPEG, PNG and WebP
            supported (max {MAX_FILES} files, {MAX_FILE_SIZE_MB} MiB each).
          </p>
        </div>
        {isManageable && (
          <div className="documents-actions">
            <label className="field-label upload-trigger" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", minHeight: "auto", padding: 0 }}>
              <Plus size={16} />
              Upload
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpeg,.jpg,.png,.webp"
                onChange={(e) => handleUpload(Array.from(e.target.files || []))}
                style={{ display: "none" }}
              />
            </label>
          </div>
        )}
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      {loading ? (
        <div className="card empty-state"><h3>Loading documents…</h3></div>
      ) : documents.length === 0 ? (
        <div className="card empty-state">
          <h3>No documents</h3>
          <p>
            {isManageable
              ? "Upload documents to get started."
              : "No documents available for this property."}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded by</th>
                <th>Uploaded at</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="doc-row">
                      <span className="doc-icon">
                        {doc.mimeType === "application/pdf" ? (
                          <FileText size={16} />
                        ) : (
                          <Image size={16} />
                        )}
                      </span>
                      <span className="doc-name">{doc.documentName}</span>
                    </div>
                  </td>
                  <td>
                    <span className="doc-type">{formatMimeLabel(doc.mimeType)}</span>
                  </td>
                  <td>
                    <span className="doc-size">
                      {doc.fileSizeBytes ? formatFileSize(Number(doc.fileSizeBytes)) : "—"}
                    </span>
                  </td>
                  <td>
                    <span className="doc-uploader">
                      {doc.uploadedBy?.fullName || "Unknown"}
                    </span>
                  </td>
                  <td>
                    <span className="doc-date">{formatDate(doc.uploadedAt)}</span>
                  </td>
                  <td className="row-actions">
                    <button
                      className="secondary-button"
                      disabled={accessLoading[doc.id]}
                      onClick={() => handleOpenDocument(doc)}
                    >
                      {accessLoading[doc.id] ? (
                        <span className="loading-dots">…</span>
                      ) : (
                        <span>Open</span>
                      )}
                    </button>
                    {isManageable && (
                      <button
                        className="text-button"
                        disabled={deleting[doc.id]}
                        onClick={() => handleDeleteDocument(doc)}
                      >
                        {deleting[doc.id] ? (
                          <span className="loading-dots">…</span>
                        ) : (
                          <>
                            <Trash2 size={14} /> Delete
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && (
        <div className="pagination">
          <span>
            Page {pagination.page} of {pagination.totalPages || 1} ·
            {pagination.total} documents
          </span>
          <div>
            <button
              className="secondary-button"
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="progress-label">
            Uploading… {uploadProgress}%
          </span>
        </div>
      )}
    </div>
  );
}