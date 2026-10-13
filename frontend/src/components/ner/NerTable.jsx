import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * NerTable — High-Contrast Institutional Operational Table
 * Clean typography, crisp borders, optional row selection, hover feedback, and responsive scrolling.
 */
export const NerTable = ({
  columns = [],
  data = [],
  keyField = 'id',
  selectedId = null,
  onRowClick,
  emptyMessage,
  className = '',
  loading = false
}) => {
  const { t } = useTranslation();
  const defaultEmptyMessage = emptyMessage || t('common.noData', 'No records available in registry.');

  return (
    <div className={`w-full overflow-x-auto bg-white border border-ner-border rounded-lg shadow-xs ${className}`}>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-ner-subtle/80 border-b border-ner-border text-ner-muted font-bold uppercase tracking-wider text-[10.5px]">
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={`py-2.5 px-3.5 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ner-border/60">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-ner-muted">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-ner-secondary border-t-transparent rounded-full animate-spin" />
                  <span>{t('common.loadingTelemetry', 'Loading operational telemetry...')}</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-ner-muted">
                {defaultEmptyMessage}
              </td>
            </tr>
          ) : (

            data.map((row, rowIdx) => {
              const rowId = row[keyField] !== undefined ? row[keyField] : rowIdx;
              const isSelected = selectedId !== null && selectedId === rowId;

              return (
                <tr
                  key={rowId}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-ner-secondary-light/70 text-ner-primary font-semibold'
                      : 'hover:bg-ner-background text-ner-text'
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`py-2.5 px-3.5 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      } ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default NerTable;
