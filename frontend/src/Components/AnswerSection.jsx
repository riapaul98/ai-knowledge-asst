export default function AnswerSection({ isLoadingAnswer, queryAns }) {
  return (
    <div className="bg-gray-100 rounded-sm m-2 p-2 border border-gray-300 min-h-32 max-h-96 overflow-y-auto">
      <p
        className={`${isLoadingAnswer && "flex items-center justify-center text-gray-400 min-h-32"}`}
      >
        {isLoadingAnswer ? "Generating answer, please wait ..." : queryAns}
      </p>
    </div>
  );
}
