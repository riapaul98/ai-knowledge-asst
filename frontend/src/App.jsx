import { useCallback, useEffect, useRef, useState } from "react";
import DocumentUpload from "./Components/DocumentUpload";
import api from "./api/api";
import QuerySection from "./Components/QuerySection";
import AnswerSection from "./Components/AnswerSection";
import SourceTable from "./Components/SourceTable";

function App() {
  const [documentList, setDocumentList] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState({
    value: "",
    label: "All documents",
  });
  const [currQuery, setCurrQuery] = useState("");
  const [userErrMsg, setUserErrMsg] = useState({ success: true, message: "" });
  const [queryAns, setQueryAns] = useState(
    "Get all your relevant queries resolved...",
  );
  const [sourceMetadata, setSourceMetadata] = useState([]);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);

  const abortController = useRef(null);

  const fetchDocumentList = useCallback(async () => {
    try {
      const documentOptions = [{ value: "", label: "All documents" }];
      const response = await api.get("/documents");
      if (response.data.success) {
        const docList = response.data.data.documentList;
        docList.forEach((doc) => {
          documentOptions.push({ value: doc.id, label: doc.filename });
        });
        setDocumentList(documentOptions);
      }
    } catch (err) {
      console.log(err);
      setDocumentList([]);
      const errMsg =
        err.response?.data?.message ?? "Failed operation: Network error!";
      setUserErrMsg({ success: false, message: errMsg });
    }
  }, []);

  async function askQuery() {
    let controller;
    try {
      if (currQuery.trim().length === 0) {
        setUserErrMsg({ success: false, message: "Query missing!" });
        return;
      }
      controller = new AbortController();
      abortController.current = controller;
      setIsLoadingAnswer(true);
      setQueryAns("");
      setSourceMetadata([]);
      setUserErrMsg({ success: true, message: "" });
      const reqBody = {
        question: currQuery.trim(),
        documentId:
          selectedDocument.value === "" ? "" : Number(selectedDocument.value),
      };
      const response = await api.post("/ask", reqBody, {
        signal: controller.signal,
      });
      if (response.data.success) {
        setQueryAns(
          response.data.data.response ?? "No relevant information found.",
        );
        const uniqueFilename = new Set();
        const sources = response.data.data.sources ?? [];
        const sourcesMeta = sources.filter((item) => {
          if (!uniqueFilename.has(item.filename)) {
            uniqueFilename.add(item.filename);
            return true;
          }
          return false;
        });
        setSourceMetadata(sourcesMeta);
      }
    } catch (err) {
      if (err.code === "ERR_CANCELED") {
        return;
      }
      console.log(err);
      setQueryAns("");
      setSourceMetadata([]);
      const errMsg =
        err.response?.data?.message ?? "Failed operation: Network error!";
      setUserErrMsg({ success: false, message: errMsg });
    } finally {
      if (abortController.current === controller) {
        setIsLoadingAnswer(false);
        abortController.current = null;
      }
    }
  }

  function resetQuery() {
    abortController.current?.abort();
    setQueryAns("Get all your relevant queries resolved...");
    setIsLoadingAnswer(false);
    setSourceMetadata([]);
    setSelectedDocument({
      value: "",
      label: "All documents",
    });
    setCurrQuery("");
    setUserErrMsg({ success: true, message: "" });
  }

  useEffect(() => {
    fetchDocumentList();
  }, [fetchDocumentList]);

  return (
    <>
      <div className="flex justify-center items-center m-2 mb-4">
        <DocumentUpload fetchDocumentApi={fetchDocumentList} />
      </div>
      <QuerySection
        documentList={documentList}
        selectedDocument={selectedDocument}
        setSelectedDocument={setSelectedDocument}
        currQuery={currQuery}
        setCurrQuery={setCurrQuery}
        setUserErrMsg={setUserErrMsg}
        isLoadingAnswer={isLoadingAnswer}
        askQuery={askQuery}
        resetQuery={resetQuery}
      />
      <AnswerSection isLoadingAnswer={isLoadingAnswer} queryAns={queryAns} />
      <SourceTable sourceMetadata={sourceMetadata} />
      {/* --------------footer-------------- */}
      <div className="m-2 text-red-500">{userErrMsg.message}</div>
    </>
  );
}

export default App;
