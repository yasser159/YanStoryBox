export function canRemoveCueFromTimeline({
  slideId,
  cueTime,
  draggedId,
}) {
  return Boolean(
    slideId
    && draggedId
    && slideId === draggedId
    && Number.isFinite(cueTime)
  );
}
