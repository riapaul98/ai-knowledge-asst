export default function SourceTable({ sourceMetadata }) {
  return (
    sourceMetadata.length > 0 && (
      <div className="m-2">
        Sources:
        <br />
        <table>
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 p-2 text-left">
                File name
              </th>
              <th className="border border-gray-300 p-2 text-left">
                Match type
              </th>
            </tr>
          </thead>

          <tbody>
            {sourceMetadata.map((item) => (
              <tr key={`${item.chunk_id}_${item.document_id}`}>
                <td className="border border-gray-300 p-2 text-left">
                  {item.filename}
                </td>
                <td className="border border-gray-300 p-2 text-left">
                  {item.matchType}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );
}
