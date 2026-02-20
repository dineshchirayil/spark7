import React from 'react';

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField?: keyof T;
  emptyMessage?: string;
}

export const Table = <T extends Record<string, any>>({ 
  data, 
  columns, 
  keyField = '_id', 
  emptyMessage = 'No data found' 
}: TableProps<T>) => {
  return (
    <div className="overflow-hidden shadow ring-1 ring-white/10 sm:rounded-lg">
      <table className="min-w-full divide-y divide-white/10 bg-white/5">
        <thead className="bg-white/5">
          <tr>
            {columns.map((col, index) => (
              <th 
                key={index} 
                scope="col" 
                className={`py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6 ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 bg-transparent">
          {data.length > 0 ? (
            data.map((item, rowIndex) => (
              <tr key={item[keyField] || rowIndex}>
                {columns.map((col, colIndex) => (
                  <td 
                    key={colIndex} 
                    className={`whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-300 sm:pl-6 ${col.className || ''}`}
                  >
                    {col.render ? col.render(item) : (col.accessor ? item[col.accessor] : null)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-sm text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};