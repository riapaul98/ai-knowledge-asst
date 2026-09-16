import { useEffect, useState } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import { useUppyEvent } from "@uppy/react";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

export default function DocumentUpload({ fetchDocumentApi }) {
  const [showUploadMsg, setShowUploadMsg] = useState(true);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uppy] = useState(() =>
    new Uppy({
      allowMultipleUploadBatches: false,
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: [".txt", ".pdf", ".docx"],
      },
    }).use(XHRUpload, {
      endpoint: "http://localhost:3000/upload",
      fieldName: "document",
    }),
  );

  const [newFileToUpload, clearNewFileToUpload] = useUppyEvent(
    uppy,
    "file-added",
  );
  const [retryUpload, clearRetryUpload] = useUppyEvent(uppy, "upload-retry");
  const [retryFailedUpload, clearRetryFailedUpload] = useUppyEvent(
    uppy,
    "retry-all",
  );
  const [uploadSuccessData, clearUploadSuccessData] = useUppyEvent(
    uppy,
    "upload-success",
  );
  const uploadedDocumentId = uploadSuccessData?.[1]?.body?.data?.documentId;
  const [uploadErrData, clearUploadErrData] = useUppyEvent(
    uppy,
    "upload-error",
  );

  useEffect(() => {
    if (!uploadMsg) return;
    const timer = setTimeout(() => {
      setShowUploadMsg(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [uploadMsg]);

  useEffect(() => {
    if (!newFileToUpload?.[0]) return;
    setUploadMsg("");
    setShowUploadMsg(true);
    clearUploadSuccessData();
    clearUploadErrData();
    clearNewFileToUpload();
  }, [newFileToUpload]);

  useEffect(() => {
    if (!retryUpload?.[0]) return;
    setUploadMsg("");
    setShowUploadMsg(true);
    clearUploadSuccessData();
    clearUploadErrData();
    clearRetryUpload();
  }, [retryUpload]);

  useEffect(() => {
    if (!retryFailedUpload?.[0]) return;
    setUploadMsg("");
    setShowUploadMsg(true);
    clearUploadSuccessData();
    clearUploadErrData();
    clearRetryFailedUpload();
  }, [retryFailedUpload]);

  useEffect(() => {
    if (uploadErrData?.[1] && uploadErrData?.[1].request) {
      const parsedMsg = JSON.parse(uploadErrData[1].request.response).message;
      setUploadMsg(parsedMsg);
    }
  }, [uploadErrData]);

  useEffect(() => {
    if (uploadSuccessData?.[1] && uploadSuccessData?.[1].body) {
      setUploadMsg(uploadSuccessData[1].body.message);
      fetchDocumentApi();
    }
  }, [uploadedDocumentId, fetchDocumentApi]);

  return (
    <div>
      <Dashboard height={"200px"} width={"350px"} uppy={uppy} />
      {showUploadMsg && <div className="m-2 text-gray-400">{uploadMsg}</div>}
    </div>
  );
}
