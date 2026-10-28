import { adjacentColumn, COLUMNS, type Card, type ColumnId } from "@/lib/board";

const columnTitle = (id: ColumnId) => COLUMNS.find((c) => c.id === id)?.title ?? id;

const iconButton =
  "rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export function CardItem({
  card,
  column,
  onMove,
  onDelete,
}: {
  card: Card;
  column: ColumnId;
  onMove: (to: ColumnId) => void;
  onDelete: () => void;
}) {
  const previous = adjacentColumn(column, -1);
  const next = adjacentColumn(column, 1);

  return (
    <li className="group rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="break-words text-sm">{card.title}</p>
      <div className="mt-2 flex items-center gap-1">
        {previous && (
          <button
            type="button"
            className={iconButton}
            aria-label={`Move "${card.title}" to ${columnTitle(previous)}`}
            onClick={() => onMove(previous)}
          >
            ←
          </button>
        )}
        {next && (
          <button
            type="button"
            className={iconButton}
            aria-label={`Move "${card.title}" to ${columnTitle(next)}`}
            onClick={() => onMove(next)}
          >
            →
          </button>
        )}
        <button
          type="button"
          className={`${iconButton} ml-auto hover:text-red-600 dark:hover:text-red-400`}
          aria-label={`Delete "${card.title}"`}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
