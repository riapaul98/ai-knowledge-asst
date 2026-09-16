import Select from "react-select";
export default function QuerySection({
  documentList,
  selectedDocument,
  setSelectedDocument,
  currQuery,
  setCurrQuery,
  setUserErrMsg,
  isLoadingAnswer,
  askQuery,
  resetQuery,
}) {
  return (
    <div className="flex gap-2">
      <div className="flex-[1] mb-3 ml-2">
        <Select
          options={documentList}
          value={selectedDocument}
          onChange={(doc) => {
            setSelectedDocument(doc);
          }}
        />
      </div>
      <div className="flex-[6]">
        <input
          type="text"
          placeholder="Type your query..."
          value={currQuery}
          onChange={(e) => {
            setUserErrMsg({ success: true, message: "" });
            setCurrQuery(e.target.value);
          }}
          className="border border-gray-300 rounded-sm w-3/4 h-10 p-2 mr-2"
        />
        <button
          className={`rounded-sm p-2 mr-2 ${isLoadingAnswer ? "text-black bg-gray-400 cursor-not-allowed" : "text-white bg-blue-600 cursor-pointer"}`}
          disabled={isLoadingAnswer}
          onClick={askQuery}
        >
          ASK
        </button>
        <button
          className={`rounded-sm p-2 text-white bg-blue-600 cursor-pointer`}
          onClick={resetQuery}
        >
          RESET
        </button>
      </div>
    </div>
  );
}
