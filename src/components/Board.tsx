"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  addCard,
  archiveList,
  boardLabels,
  boardLists,
  boardStats,
  boardView,
  deleteArchived,
  deleteCard,
  duplicateCard,
  filterByLabel,
  filterCards,
  filterOverdue,
  findCard,
  type Card,
  type ColumnId,
  insightsListIds,
  isCardOverdue,
  isFiltering,
  listCards,
  moveCard,
  renameCard,
  restoreCard,
  setDueDate,
  setNotes,
  setPriority,
  setView,
  setWipLimit,
  undoArchive,
  updateCard,
} from "@/lib/board";
import { useBoard } from "@/lib/useBoard";
import { AddCardForm } from "./AddCardForm";
import { ArchivePanel } from "./ArchivePanel";
import { CardDialog } from "./CardDialog";
import { CARD_DRAG_TYPE, CardItem } from "./CardItem";
import { ColumnHeader } from "./ColumnHeader";
import { InsightsPanel } from "./InsightsPanel";
import { LabelFilter } from "./LabelFilter";
import { ListsManager } from "./ListsManager";
import { SearchBox } from "./SearchBox";
import { SummaryBar } from "./SummaryBar";
import { TableView } from "./TableView";
import { UndoToast } from "./UndoToast";
import { ViewSwitch } from "./ViewSwitch";
import { Button } from "./ui";

export function Board() {
  const [board, update] = useBoard();
  const [query, setQuery] = useState("");
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const stats = boardStats(board);
  // The filter lapses by itself once nothing is overdue any more.
  const showOverdueOnly = overdueOnly && stats.overdue > 0;
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const labelsInUse = boardLabels(board);
  // Like the overdue filter, the label filter lapses once no card has the label any more.
  const activeLabel =
    labelFilter !== null && labelsInUse.some((l) => l.toLowerCase() === labelFilter.toLowerCase()) ? labelFilter : null;
  const visible = filterByLabel(filterCards(showOverdueOnly ? filterOverdue(board) : board, query), activeLabel);
  const filtering = isFiltering(query) || showOverdueOnly || activeLabel !== null;
  const [dragOver, setDragOver] = useState<ColumnId | null>(null);
  const dragSource = useRef<{ id: string; column: ColumnId } | null>(null);

  const [showArchive, setShowArchive] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const insightsButtonRef = useRef<HTMLButtonElement>(null);
  const [showLists, setShowLists] = useState(false);
  const listsButtonRef = useRef<HTMLButtonElement>(null);
  const lists = boardLists(board);
  const view = boardView(board);
  const doneId = insightsListIds(board).done;

  function closeInsights() {
    setShowInsights(false);
    requestAnimationFrame(() => insightsButtonRef.current?.focus());
  }

  function closeLists() {
    setShowLists(false);
    requestAnimationFrame(() => listsButtonRef.current?.focus());
  }
  const [undo, setUndo] = useState<{ cards: Card[]; listId: ColumnId; message: string } | null>(null);
  const dismissUndo = useCallback(() => setUndo(null), []);

  function archiveListCards(listId: ColumnId) {
    const cards = listCards(board, listId);
    if (cards.length === 0) {
      return;
    }
    update((b) => archiveList(b, listId));
    const what = listId === doneId ? "done " : "";
    setUndo({ cards, listId, message: `Archived ${cards.length} ${what}${cards.length === 1 ? "card" : "cards"}` });
  }

  function undoLastArchive() {
    if (undo) {
      const { cards, listId } = undo;
      update((b) => undoArchive(b, cards, { listId }));
    }
    setUndo(null);
  }

  // Only our own cards, and only from another column, are valid drops.
  const canDrop = (event: DragEvent<HTMLElement>, column: ColumnId) =>
    Array.from(event.dataTransfer.types).includes(CARD_DRAG_TYPE) &&
    dragSource.current !== null &&
    dragSource.current.column !== column;

  function handleDragOver(event: DragEvent<HTMLElement>, column: ColumnId) {
    if (!canDrop(event, column)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOver(column);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>, column: ColumnId) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setDragOver((current) => (current === column ? null : current));
  }

  function handleDrop(event: DragEvent<HTMLElement>, column: ColumnId) {
    setDragOver(null);
    if (!canDrop(event, column)) {
      return;
    }
    event.preventDefault();
    dragSource.current = null; // the dragged card unmounts on move, so dragend may never fire
    const id = event.dataTransfer.getData(CARD_DRAG_TYPE);
    if (!id) {
      return;
    }
    update((b) => (findCard(b, id) ? moveCard(b, id, column) : b));
  }

  // Looked up in the unfiltered board so an active search never drops the open dialog.
  const open = openCardId ? findCard(board, openCardId) : undefined;

  // The card may have changed column (and remounted), so find its title button in the DOM after the commit.
  function closeDialog(focusCardId?: string) {
    setOpenCardId(null);
    requestAnimationFrame(() => {
      const target = focusCardId
        ? document.querySelector<HTMLElement>(`[data-card-id="${focusCardId}"] button.card-title`)
        : document.querySelector<HTMLElement>('input[aria-label="New card title"]');
      target?.focus();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {openCardId && open && (
        <CardDialog
          key={openCardId}
          card={open.card}
          column={open.column}
          board={board}
          onChecklist={update}
          onSave={(edits) => {
            update((b) => updateCard(b, openCardId, edits));
            closeDialog(openCardId);
          }}
          onDelete={() => {
            update((b) => deleteCard(b, openCardId));
            closeDialog();
          }}
          onDuplicate={() => {
            const id = crypto.randomUUID();
            update((b) => duplicateCard(b, openCardId, { id }));
            setOpenCardId(id);
          }}
          onClose={() => closeDialog(openCardId)}
          onUpdateBoard={update}
        />
      )}
      <SummaryBar stats={stats} overdueOnly={showOverdueOnly} onToggleOverdue={() => setOverdueOnly(!showOverdueOnly)} />

      <AddCardForm onAdd={(title) => update((b) => addCard(b, title))} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <LabelFilter labels={labelsInUse} value={activeLabel} onChange={setLabelFilter} />
        <ViewSwitch value={view} onChange={(next) => update((b) => setView(b, next))} />
        <Button
          aria-expanded={showArchive}
          aria-controls="archive-panel"
          onClick={() => setShowArchive((open) => !open)}
          className="bg-surface"
        >
          Archived ({board.archive.length})
        </Button>
        <Button ref={insightsButtonRef} aria-haspopup="dialog" onClick={() => setShowInsights(true)} className="bg-surface">
          Board insights
        </Button>
        <Button ref={listsButtonRef} aria-haspopup="dialog" onClick={() => setShowLists(true)} className="bg-surface">
          Manage lists
        </Button>
      </div>
      {showLists && <ListsManager board={board} onUpdateBoard={update} onClose={closeLists} />}
      {showInsights && (
        <InsightsPanel
          board={board}
          onUpdateBoard={update}
          onClose={closeInsights}
          onOpenCard={(cardId) => {
            setShowInsights(false);
            setOpenCardId(cardId);
          }}
        />
      )}

      {showArchive && (
        <ArchivePanel
          id="archive-panel"
          cards={board.archive}
          onRestore={(cardId) => update((b) => (b.archive.some((c) => c.id === cardId) ? restoreCard(b, cardId) : b))}
          onDelete={(cardId) => update((b) => (b.archive.some((c) => c.id === cardId) ? deleteArchived(b, cardId) : b))}
        />
      )}

      {undo && <UndoToast message={undo.message} onUndo={undoLastArchive} onDismiss={dismissUndo} />}

      {view === "table" ? (
        <TableView board={visible} onOpen={setOpenCardId} />
      ) : (
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:overflow-x-auto">
        {lists.map(({ id, name: title }) => {
          const cards = listCards(visible, id);
          return (
            <section
              key={id}
              aria-labelledby={`column-${id}`}
              onDragEnter={(event) => handleDragOver(event, id)}
              onDragOver={(event) => handleDragOver(event, id)}
              onDragLeave={(event) => handleDragLeave(event, id)}
              onDrop={(event) => handleDrop(event, id)}
              className={`flex flex-col gap-3 rounded-xl p-3 md:min-w-64 md:flex-1 md:basis-0 ${
                dragOver === id
                  ? "bg-indigo-50 ring-2 ring-indigo-500 dark:bg-indigo-950/40"
                  : "bg-surface-muted dark:bg-surface/50"
              }`}
            >
              <ColumnHeader
                id={id}
                title={title}
                total={listCards(board, id).length}
                limit={board.wipLimits?.[id]}
                onSetLimit={(limit) => update((b) => setWipLimit(b, id, limit))}
              >
                <Button
                  size="xs"
                  aria-label={id === doneId ? undefined : `Archive all cards in ${title}`}
                  disabled={listCards(board, id).length === 0}
                  onClick={() => archiveListCards(id)}
                >
                  {id === doneId ? "Archive done" : "Archive all"}
                </Button>
              </ColumnHeader>
              {cards.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted">
                  {filtering ? "No matching cards" : "No cards"}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <CardItem
                      key={card.id}
                      card={card}
                      column={id}
                      lists={lists}
                      overdue={isCardOverdue(board, card, id)}
                      onMove={(to) => update((b) => moveCard(b, card.id, to))}
                      onDelete={() => update((b) => deleteCard(b, card.id))}
                      onRename={(title) => update((b) => renameCard(b, card.id, title))}
                      onSetDueDate={(date) => update((b) => setDueDate(b, card.id, date))}
                      onSetNotes={(notes) => update((b) => setNotes(b, card.id, notes))}
                      onSetPriority={(priority) => update((b) => setPriority(b, card.id, priority))}
                      onOpen={() => setOpenCardId(card.id)}
                      onFilterLabel={setLabelFilter}
                      onDragStart={() => {
                        dragSource.current = { id: card.id, column: id };
                      }}
                      onDragEnd={() => {
                        dragSource.current = null;
                        setDragOver(null);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}
