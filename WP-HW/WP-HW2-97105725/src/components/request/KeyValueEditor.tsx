import type { KeyValueRow } from "../../app/types";
import { Button } from "../common/Button";
import { createEmptyRow, ensureEditableRows } from "../../utils/requestConfig";

interface KeyValueEditorProps {
  label: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}

function toDomIdPart(value: string): string {
  return encodeURIComponent(value || "empty").replace(/%/g, "_");
}

export function KeyValueEditor({
  label,
  keyPlaceholder,
  valuePlaceholder,
  rows,
  onChange,
}: KeyValueEditorProps) {
  const editorId = toDomIdPart(label.toLowerCase());

  const updateRow = (rowId: string, patch: Partial<KeyValueRow>) => {
    onChange(ensureEditableRows(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))));
  };

  const deleteRow = (rowId: string) => {
    onChange(ensureEditableRows(rows.filter((row) => row.id !== rowId)));
  };

  return (
    <section className="editor-section" aria-label={label}>
      <div className="section-title-row">
        <h3>{label}</h3>
        <Button onClick={() => onChange([...rows, createEmptyRow()])} size="sm" variant="secondary">
          Add row
        </Button>
      </div>
      <div className="kv-grid kv-grid-heading" aria-hidden="true">
        <span>On</span>
        <span>Key</span>
        <span>Value</span>
        <span />
      </div>
      <div className="kv-rows">
        {rows.map((row, index) => {
          const rowId = toDomIdPart(row.id);
          const rowControlId = `${editorId}-${rowId}`;

          return (
            <div className="kv-grid" key={row.id}>
              <input
                aria-label={`${label} row ${index + 1} enabled`}
                checked={row.enabled}
                id={`${rowControlId}-enabled`}
                name={`${rowControlId}-enabled`}
                onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
                type="checkbox"
              />
              <input
                aria-label={`${label} row ${index + 1} key`}
                id={`${rowControlId}-key`}
                name={`${rowControlId}-key`}
                onChange={(event) => updateRow(row.id, { key: event.target.value })}
                placeholder={keyPlaceholder}
                value={row.key}
              />
              <input
                aria-label={`${label} row ${index + 1} value`}
                id={`${rowControlId}-value`}
                name={`${rowControlId}-value`}
                onChange={(event) => updateRow(row.id, { value: event.target.value })}
                placeholder={valuePlaceholder}
                value={row.value}
              />
              <Button aria-label={`Delete ${label} row ${index + 1}`} onClick={() => deleteRow(row.id)} size="sm" variant="ghost">
                X
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
