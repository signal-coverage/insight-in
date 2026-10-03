// The kind of data a card carries while it is dragged. Only a drag of this kind is accepted by a
// column, so a file or some text dropped on the board is ignored.
export const DRAG_TYPE = "application/x-insight-roadmap-item";

// The accessible names of what a column holds and of its add button.
export const listLabel = (title: string): string => `Tarjetas de ${title}`;
export const addLabel = (title: string): string =>
  `Agregar una tarjeta a ${title}`;
